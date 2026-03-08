import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';
import { SStaticMesh } from '../geometry/SStaticMesh';

export interface SDrawCall {
  mesh: SStaticMesh;
  count: number;
  startOffsetBytes: number;
}

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Capa 12: Cascaded Shadow Maps (CSM) and Multi-Pass RHI.
 */
export class SerionRHI {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private renderPipeline: GPURenderPipeline | null = null;
  private shadowPipeline: GPURenderPipeline | null = null;

  private cameraBuffer: GPUBuffer | null = null;
  private instanceBuffer: GPUBuffer | null = null;
  private cameraBindGroup: GPUBindGroup | null = null;

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
    this.createDepthTexture(this.currentWidth, this.currentHeight);
    this.createShadowMaps();

    const shaderModule = this.device.createShaderModule({ code: BasicShaderWGSL });

    // 1. Layout de Bind Group Global (272 bytes + 2 Shadow Maps + 1 Sampler)
    const envLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }, // ShadowMap0
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }, // ShadowMap1
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } }  // ShadowSampler
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [envLayout] });

    // 2. Main Render Pipeline (PBR + Shadows)
    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Pos
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // Normal
          { shaderLocation: 2, offset: 24, format: 'float32x2' }  // UV
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

    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
    });

    // 3. Shadow Pipeline (Depth Only)
    this.shadowPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth32float' }
    });

    // 4. Buffers and Bind Groups
    this.cameraBuffer = this.device.createBuffer({ size: 272, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.instanceBuffer = this.device.createBuffer({ size: maxEntities * 160, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

    this.shadowSampler = this.device.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });

    this.cameraBindGroup = this.device.createBindGroup({
      layout: envLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: this.shadowView0! },
        { binding: 2, resource: this.shadowView1! },
        { binding: 3, resource: this.shadowSampler! }
      ]
    });

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

  private createDepthTexture(width: number, height: number): void {
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device!.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
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
        view: null as unknown as GPUTextureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
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

  public renderFrame(drawCalls: SDrawCall[], activeCallCount: number, globalEnvData: Float32Array, fullInstanceData: Float32Array): void {
    if (!this.device || !this.context || !this.mainPassDescriptor || !this.renderPipeline || !this.canvas) return;

    // Resize Detection
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
      this.createDepthTexture(targetW, targetH);
      this.updatePassDescriptors();
    }

    // Update Buffers
    this.device.queue.writeBuffer(this.cameraBuffer!, 0, globalEnvData.buffer, globalEnvData.byteOffset, 272);
    this.device.queue.writeBuffer(this.instanceBuffer!, 0, fullInstanceData.buffer, fullInstanceData.byteOffset, fullInstanceData.byteLength);

    const encoder = this.device.createCommandEncoder();

    // PASS 0: Shadow Cascade 0
    const pass0 = encoder.beginRenderPass(this.shadowPassDescriptor0!);
    pass0.setPipeline(this.shadowPipeline!);
    pass0.setBindGroup(0, this.cameraBindGroup!);
    this.recordDrawCalls(pass0, drawCalls, activeCallCount);
    pass0.end();

    // PASS 1: Shadow Cascade 1
    const pass1 = encoder.beginRenderPass(this.shadowPassDescriptor1!);
    pass1.setPipeline(this.shadowPipeline!);
    pass1.setBindGroup(0, this.cameraBindGroup!);
    this.recordDrawCalls(pass1, drawCalls, activeCallCount);
    pass1.end();

    // PASS 2: Main Beauty Pass
    const attachments = this.mainPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    attachments[0].view = this.context.getCurrentTexture().createView();
    const mainPass = encoder.beginRenderPass(this.mainPassDescriptor);
    mainPass.setPipeline(this.renderPipeline);
    mainPass.setBindGroup(0, this.cameraBindGroup!);
    this.recordDrawCalls(mainPass, drawCalls, activeCallCount);
    mainPass.end();

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
