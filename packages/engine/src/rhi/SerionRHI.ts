import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';
import { GridShaderWGSL } from './shaders/GridShader.wgsl';
import { SkyShaderWGSL } from './shaders/SkyShader.wgsl';
import { PostProcessShaderWGSL } from './shaders/PostProcessShader.wgsl';
import { BloomShaderWGSL } from './shaders/BloomShader.wgsl';
import { SStaticMesh } from '../geometry/SStaticMesh';
import { SGlobalEnvironmentData } from '../core/SGlobalEnvironmentData';

export interface SDrawCall {
  mesh: SStaticMesh;
  count: number;
  startOffsetBytes: number;
}

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Capa 13.13: AAA Dual-Filter Bloom Pyramid (Kawase).
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

  // AAA Bloom Pyramid (Kawase)
  private bloomMipTextures: GPUTexture[] = [];
  private bloomMipViews: GPUTextureView[] = [];
  private bloomBindGroups: GPUBindGroup[] = [];
  private bloomLayout: GPUBindGroupLayout | null = null;
  
  private extractPipeline: GPURenderPipeline | null = null;
  private downsamplePipeline: GPURenderPipeline | null = null;
  private upsamplePipeline: GPURenderPipeline | null = null;

  private extractBindGroup: GPUBindGroup | null = null;

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
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      ]
    });

    this.bloomLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [envLayout] });
    const postProcessPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.postProcessLayout] });
    const bloomPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [this.bloomLayout!] });

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

    // Shadow Pipelines 
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

    // Grid Pipeline
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

    // Sky Pipeline
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

    // 4. Bloom Pipelines (Kawase Pyramid)
    const bloomShaderModule = this.device.createShaderModule({ code: BloomShaderWGSL });
    
    this.extractPipeline = this.device.createRenderPipeline({
      layout: bloomPipelineLayout,
      vertex: { module: bloomShaderModule, entryPoint: 'vs_main' },
      fragment: { module: bloomShaderModule, entryPoint: 'fs_extract', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-strip' }
    });

    this.downsamplePipeline = this.device.createRenderPipeline({
      layout: bloomPipelineLayout,
      vertex: { module: bloomShaderModule, entryPoint: 'vs_main' },
      fragment: { module: bloomShaderModule, entryPoint: 'fs_downsample', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-strip' }
    });

    this.upsamplePipeline = this.device.createRenderPipeline({
      layout: bloomPipelineLayout,
      vertex: { module: bloomShaderModule, entryPoint: 'vs_main' },
      fragment: { 
        module: bloomShaderModule, 
        entryPoint: 'fs_upsample', 
        targets: [{ 
          format: 'rgba16float',
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
          }
        }] 
      },
      primitive: { topology: 'triangle-strip' }
    });

    // Buffer Global de Entorno
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

    // Textura HDR Off-Screen
    this.hdrTexture = this.device!.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    this.hdrTextureView = this.hdrTexture.createView();

    // Limpiar Mips Antiguos
    this.bloomMipTextures.forEach(t => t.destroy());
    this.bloomMipTextures = [];
    this.bloomMipViews = [];
    this.bloomBindGroups = [];

    // Crear Pirámide de Bloom (5 Niveles)
    let mipW = width;
    let mipH = height;

    for (let i = 0; i < 5; i++) {
        mipW = Math.max(1, Math.floor(mipW / 2));
        mipH = Math.max(1, Math.floor(mipH / 2));

        const tex = this.device!.createTexture({
            size: [mipW, mipH],
            format: 'rgba16float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        const view = tex.createView();

        this.bloomMipTextures.push(tex);
        this.bloomMipViews.push(view);
        this.bloomBindGroups.push(this.device!.createBindGroup({
            layout: this.bloomLayout!,
            entries: [
                { binding: 0, resource: this.linearSampler! },
                { binding: 1, resource: view }
            ]
        }));
    }

    // BindGroup de Extracción (Lee del HDR original)
    this.extractBindGroup = this.device!.createBindGroup({
        layout: this.bloomLayout!,
        entries: [
            { binding: 0, resource: this.linearSampler! },
            { binding: 1, resource: this.hdrTextureView }
        ]
    });

    // BindGroup del Post-Procesado (Usa el Mip 0 como resultado final acumulado)
    this.postProcessBindGroup = this.device!.createBindGroup({
      layout: this.postProcessLayout!,
      entries: [
        { binding: 0, resource: this.linearSampler! },
        { binding: 1, resource: this.hdrTextureView },
        { binding: 2, resource: this.bloomMipViews[0] }
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
        view: this.hdrTextureView!,
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

    this.device.queue.writeBuffer(this.cameraBuffer!, 0, globalEnvData.buffer);

    if (fullInstanceData.byteLength > 0) {
      this.device.queue.writeBuffer(this.instanceBuffer!, 0, fullInstanceData.buffer, fullInstanceData.byteOffset, fullInstanceData.byteLength);
    }

    const encoder = this.device.createCommandEncoder();

    // 1. PASES DE SOMBRA (CSM)
    this.executeShadowPass(encoder, this.shadowPassDescriptor0!, this.shadowPipeline0!, drawCalls, activeCallCount);
    this.executeShadowPass(encoder, this.shadowPassDescriptor1!, this.shadowPipeline1!, drawCalls, activeCallCount);

    // 2. PASE DE BELLEZA (Beauty Pass HDR)
    const mainPass = encoder.beginRenderPass(this.mainPassDescriptor!);
    mainPass.setPipeline(this.renderPipeline);
    mainPass.setBindGroup(0, this.cameraBindGroup!);
    this.recordDrawCalls(mainPass, drawCalls, activeCallCount);

    if (this.skyPipeline) {
      mainPass.setPipeline(this.skyPipeline);
      mainPass.draw(4, 1, 0, 0);
    }

    if (this.gridPipeline) {
      mainPass.setPipeline(this.gridPipeline);
      mainPass.draw(6, 1, 0, 0);
    }
    mainPass.end();

    // 3. BLOOM PYRAMID (Kawase)

    // A. Extracción suave (HDR Scena -> Bloom Mip 0)
    const extractPass = encoder.beginRenderPass({
        colorAttachments: [{
            view: this.bloomMipViews[0],
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store'
        }]
    });
    extractPass.setPipeline(this.extractPipeline!);
    extractPass.setBindGroup(0, this.extractBindGroup!);
    extractPass.draw(4, 1, 0, 0);
    extractPass.end();

    // B. Downsample Loop (Iterativo Mip i -> Mip i+1)
    for (let i = 0; i < 4; i++) {
        const downPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.bloomMipViews[i + 1],
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                storeOp: 'store'
            }]
        });
        downPass.setPipeline(this.downsamplePipeline!);
        downPass.setBindGroup(0, this.bloomBindGroups[i]);
        downPass.draw(4, 1, 0, 0);
        downPass.end();
    }

    // C. Upsample Loop (Iterativo Mip i -> Mip i-1 con Adición)
    for (let i = 4; i > 0; i--) {
        const upPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.bloomMipViews[i - 1],
                loadOp: 'load', // ¡IMPORTANTE! Sumar al contenido existente
                storeOp: 'store'
            }]
        });
        upPass.setPipeline(this.upsamplePipeline!);
        upPass.setBindGroup(0, this.bloomBindGroups[i]);
        upPass.draw(4, 1, 0, 0);
        upPass.end();
    }

    // 4. PASE FINAL (Post-Process + Merge Bloom Mip 0)
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