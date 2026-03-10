import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';
import { GridShaderWGSL } from './shaders/GridShader.wgsl';
import { SkyShaderWGSL } from './shaders/SkyShader.wgsl';
import { PostProcessShaderWGSL } from './shaders/PostProcessShader.wgsl';
import { SStaticMesh } from '../geometry/SStaticMesh';
import { SGlobalEnvironmentData } from '../core/SGlobalEnvironmentData';

export interface SDrawCall {
  mesh: SStaticMesh;
  count: number;
  startOffsetBytes: number;
}

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Capa 13.10: GPU Sky Pass con Early-Z.
 */
export class SerionRHI {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private renderPipeline: GPURenderPipeline | null = null;
  private shadowPipeline0: GPURenderPipeline | null = null;
  private shadowPipeline1: GPURenderPipeline | null = null;
  private gridPipeline: GPURenderPipeline | null = null;
  private skyPipeline: GPURenderPipeline | null = null;

  private cameraBuffer: GPUBuffer | null = null;
  private instanceBuffer: GPUBuffer | null = null;

  private cameraBindGroup: GPUBindGroup | null = null;
  private shadowBindGroup: GPUBindGroup | null = null;

  // Shadow Resources
  private shadowTexture0: GPUTexture | null = null;
  private shadowTexture1: GPUTexture | null = null;
  private shadowView0: GPUTextureView | null = null;
  private shadowView1: GPUTextureView | null = null;
  private shadowSampler: GPUSampler | null = null;

  private depthTexture: GPUTexture | null = null;
  private depthTextureView: GPUTextureView | null = null;
  private currentWidth = 0;
  private currentHeight = 0;

  private shadowPassDescriptor0: GPURenderPassDescriptor | null = null;
  private shadowPassDescriptor1: GPURenderPassDescriptor | null = null;
  private mainPassDescriptor: GPURenderPassDescriptor | null = null;

  // HDR & Post-Process Resources
  private hdrTexture: GPUTexture | null = null;
  private hdrTextureView: GPUTextureView | null = null;
  private postProcessPipeline: GPURenderPipeline | null = null;
  private postProcessBindGroup: GPUBindGroup | null = null;
  private postProcessLayout: GPUBindGroupLayout | null = null;
  private linearSampler: GPUSampler | null = null;

  public async initialize(canvas: HTMLCanvasElement, maxEntities: number): Promise<void> {
    this.canvas = canvas;

    if (!navigator.gpu) {
      Logger.fatal('RHI', "WebGPU no soportado.");
      throw new Error("WebGPU no soportado.");
    }

    this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!this.adapter) throw new Error("No adapter found.");

    this.device = await this.adapter.requestDevice();
    if (!this.device) throw new Error("No device found.");

    this.context = canvas.getContext('webgpu');
    if (!this.context) throw new Error("No context found.");

    this.format = navigator.gpu.getPreferredCanvasFormat();

    const dpr = window.devicePixelRatio || 1;
    this.currentWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    this.currentHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = this.currentWidth;
    canvas.height = this.currentHeight;

    this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
    this.createShadowMaps();

    const shaderModule = this.device.createShaderModule({ code: BasicShaderWGSL });

    // 1. Layout Principal (Cámara Jugador)
    const envLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } }
      ]
    });

    this.postProcessLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [envLayout] });
    const postProcessPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.postProcessLayout] });

    // 2. Layout Sombras (Cámara Sol)
    const shadowEnvLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }
      ]
    });
    const shadowPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [shadowEnvLayout] });

    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32x2' }
        ]
      },
      {
        arrayStride: 160,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 3, offset: 0, format: 'float32x4' },
          { shaderLocation: 4, offset: 16, format: 'float32x4' },
          { shaderLocation: 5, offset: 32, format: 'float32x4' },
          { shaderLocation: 6, offset: 48, format: 'float32x4' },
          { shaderLocation: 7, offset: 64, format: 'float32x4' },
          { shaderLocation: 8, offset: 80, format: 'float32x4' },
          { shaderLocation: 9, offset: 96, format: 'float32x4' },
          { shaderLocation: 10, offset: 112, format: 'float32x4' },
          { shaderLocation: 11, offset: 128, format: 'float32x4' },
          { shaderLocation: 12, offset: 144, format: 'float32x4' }
        ]
      }
    ];

    // Main Render Pipeline
    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
    });

    // Shadow Pipelines (Aislamiento de Entry Points)
    this.shadowPipeline0 = this.device.createRenderPipeline({
      layout: shadowPipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'shadow_vs_main_c0', buffers: vertexBuffers },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float',
        depthBias: 3,
        depthBiasSlopeScale: 2.0,
        depthBiasClamp: 0.0
      }
    });

    this.shadowPipeline1 = this.device.createRenderPipeline({
      layout: shadowPipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'shadow_vs_main_c1', buffers: vertexBuffers },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float',
        depthBias: 3,
        depthBiasSlopeScale: 2.0,
        depthBiasClamp: 0.0
      }
    });

    // Grid Pipeline (Capa 13.4)
    this.gridPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: this.device.createShaderModule({ code: GridShaderWGSL }), entryPoint: 'vs_main' },
      fragment: {
        module: this.device.createShaderModule({ code: GridShaderWGSL }),
        entryPoint: 'fs_main',
        targets: [{
          format: 'rgba16float',
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }]
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' }
    });

    // Sky Pipeline (Capa 13.10)
    this.skyPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: this.device.createShaderModule({ code: SkyShaderWGSL }), entryPoint: 'vs_main' },
      fragment: { module: this.device.createShaderModule({ code: SkyShaderWGSL }), entryPoint: 'fs_main', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-strip' },
      depthStencil: { depthWriteEnabled: false, depthCompare: 'less-equal', format: 'depth24plus' }
    });

    // 3. Post-Process Pipeline
    this.postProcessPipeline = this.device.createRenderPipeline({
      layout: postProcessPipelineLayout,
      vertex: { module: this.device.createShaderModule({ code: PostProcessShaderWGSL }), entryPoint: 'vs_main' },
      fragment: { module: this.device.createShaderModule({ code: PostProcessShaderWGSL }), entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-strip' }
    });

    // Buffer Global de Entorno (320 Bytes / 80 floats)
    this.cameraBuffer = this.device.createBuffer({ size: 320, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.instanceBuffer = this.device.createBuffer({ size: maxEntities * 160, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

    this.shadowSampler = this.device.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    this.linearSampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    // Cámara Principal
    this.cameraBindGroup = this.device.createBindGroup({
      layout: envLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: this.shadowView0! },
        { binding: 2, resource: this.shadowView1! },
        { binding: 3, resource: this.shadowSampler! }
      ]
    });

    // Sombras
    this.shadowBindGroup = this.device.createBindGroup({
      layout: shadowEnvLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } }
      ]
    });

    // LA CIRUGÍA: Movemos la creación de los Targets aquí, 
    // cuando TODOS los layouts y samplers ya existen en memoria.
    this.createRenderTargets(this.currentWidth, this.currentHeight);

    this.updatePassDescriptors();
  }

  private createShadowMaps(): void {
    const size = 2048;
    const desc: GPUTextureDescriptor = {
      size: [size, size],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    };
    this.shadowTexture0 = this.device!.createTexture(desc);
    this.shadowTexture1 = this.device!.createTexture(desc);
    this.shadowView0 = this.shadowTexture0.createView();
    this.shadowView1 = this.shadowTexture1.createView();
  }

  private createRenderTargets(width: number, height: number): void {
    if (this.depthTexture) this.depthTexture.destroy();
    if (this.hdrTexture) this.hdrTexture.destroy();

    // Textura de Profundidad
    this.depthTexture = this.device!.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();

    // Textura HDR Off-Screen (Alta Precisión)
    this.hdrTexture = this.device!.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    this.hdrTextureView = this.hdrTexture.createView();

    // BindGroup del Post-Procesado (Zero-GC: Se recrea solo en Resize)
    this.postProcessBindGroup = this.device!.createBindGroup({
      layout: this.postProcessLayout!,
      entries: [
        { binding: 0, resource: this.linearSampler! },
        { binding: 1, resource: this.hdrTextureView }
      ]
    });
  }

  private updatePassDescriptors(): void {
    this.shadowPassDescriptor0 = {
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowView0!,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
    this.shadowPassDescriptor1 = {
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowView1!,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
    this.mainPassDescriptor = {
      colorAttachments: [{
        view: this.hdrTextureView!, // El Main Pass siempre escribe en el HDR Target
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTextureView!,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
  }
  /**
   * Ejecuta un pase de renderizado de sombras para una cascada específica.
   */
  private executeShadowPass(
    encoder: GPUCommandEncoder,
    descriptor: GPURenderPassDescriptor,
    pipeline: GPURenderPipeline,
    drawCalls: SDrawCall[],
    activeCount: number
  ): void {
    const pass = encoder.beginRenderPass(descriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.shadowBindGroup!);
    this.recordDrawCalls(pass, drawCalls, activeCount);
    pass.end();
  }

  /**
   * Renderiza un frame completo incluyendo cascadas de sombras, pase de belleza y cielo procedural.
   */
  public renderFrame(
    drawCalls: SDrawCall[],
    activeCallCount: number,
    globalEnvData: SGlobalEnvironmentData,
    fullInstanceData: Float32Array
  ): void {
    if (!this.device || !this.context || !this.mainPassDescriptor || !this.renderPipeline || !this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.floor(this.canvas.clientWidth * dpr);
    const targetH = Math.floor(this.canvas.clientHeight * dpr);
    if (targetW === 0 || targetH === 0) return;

    if (this.currentWidth !== targetW || this.currentHeight !== targetH) {
      this.currentWidth = targetW;
      this.currentHeight = targetH;
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
      this.createRenderTargets(targetW, targetH);
      this.updatePassDescriptors();
    }

    // Carga de datos a la GPU (Zero-GC)
    this.device.queue.writeBuffer(this.cameraBuffer!, 0, globalEnvData.buffer);

    // BLINDAJE: Solo enviamos datos de instancias si realmente hay alguna que pintar
    if (fullInstanceData.byteLength > 0) {
      this.device.queue.writeBuffer(this.instanceBuffer!, 0, fullInstanceData.buffer, fullInstanceData.byteOffset, fullInstanceData.byteLength);
    }

    const encoder = this.device.createCommandEncoder();

    // 1. PASES DE SOMBRA (CSM)
    this.executeShadowPass(encoder, this.shadowPassDescriptor0!, this.shadowPipeline0!, drawCalls, activeCallCount);
    this.executeShadowPass(encoder, this.shadowPassDescriptor1!, this.shadowPipeline1!, drawCalls, activeCallCount);

    // 2. PASE DE BELLEZA (Beauty Pass HDR)
    const mainPass = encoder.beginRenderPass(this.mainPassDescriptor!);

    // Objetos Opacos
    mainPass.setPipeline(this.renderPipeline);
    mainPass.setBindGroup(0, this.cameraBindGroup!);
    this.recordDrawCalls(mainPass, drawCalls, activeCallCount);

    // 3. PASE DE CIELO PROCEDURAL (Early-Z Rejection)
    if (this.skyPipeline) {
      mainPass.setPipeline(this.skyPipeline);
      mainPass.draw(4, 1, 0, 0);
    }

    // 4. PASE DE REJILLA (Grid Overlay)
    if (this.gridPipeline) {
      mainPass.setPipeline(this.gridPipeline);
      mainPass.draw(6, 1, 0, 0);
    }

    mainPass.end();

    // 5. PASE DE POST-PROCESADO (Final Output a Pantalla)
    const postProcessPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }]
    });
    postProcessPass.setPipeline(this.postProcessPipeline!);
    postProcessPass.setBindGroup(0, this.postProcessBindGroup!);
    postProcessPass.draw(4, 1, 0, 0);
    postProcessPass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  private recordDrawCalls(pass: GPURenderPassEncoder, drawCalls: SDrawCall[], count: number): void {
    for (let i = 0; i < count; i++) {
      const call = drawCalls[i];
      pass.setVertexBuffer(0, call.mesh.vertexBuffer);
      pass.setVertexBuffer(1, this.instanceBuffer!, call.startOffsetBytes);
      pass.setIndexBuffer(call.mesh.indexBuffer, 'uint16');
      pass.drawIndexed(call.mesh.indexCount, call.count);
    }
  }

  public getAspectRatio(): number {
    return (this.canvas?.clientWidth || 1) / (this.canvas?.clientHeight || 1);
  }

  public getDevice(): GPUDevice { return this.device!; }
}