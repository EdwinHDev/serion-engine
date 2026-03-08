import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';
import { SStaticMesh } from '../geometry/SStaticMesh';

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Capa 10: PBR Hemispheric Lighting & Normal Matrix Support.
 */
export class SerionRHI {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private renderPipeline: GPURenderPipeline | null = null;

  private cameraBuffer: GPUBuffer | null = null;
  private instanceBuffer: GPUBuffer | null = null;
  private cameraBindGroup: GPUBindGroup | null = null;

  private depthTexture: GPUTexture | null = null;
  private currentWidth = 0;
  private currentHeight = 0;
  private renderPassDescriptor: GPURenderPassDescriptor | null = null;

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
    this.currentWidth = Math.floor(canvas.clientWidth * dpr);
    this.currentHeight = Math.floor(canvas.clientHeight * dpr);
    canvas.width = this.currentWidth;
    canvas.height = this.currentHeight;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.createDepthTexture(this.currentWidth, this.currentHeight);

    // Bind Group Layout: Global Environment (144 bytes)
    const envLayout = this.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
    });

    const shaderModule = this.device.createShaderModule({ code: BasicShaderWGSL });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [envLayout] });

    // Pipeline: Layout Entrelazado + Instanced Drawing
    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          // Buffer 0: Malla (Pos, Norm, UV) - 32 bytes stride
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
              { shaderLocation: 1, offset: 12, format: 'float32x3' }, // Normal
              { shaderLocation: 2, offset: 24, format: 'float32x2' }  // UV
            ]
          },
          // Buffer 1: Instancias (Model Matrix + Normal Matrix) - 128 bytes stride
          {
            arrayStride: 128,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 3, offset: 0, format: 'float32x4' },  // Model Matrix R0
              { shaderLocation: 4, offset: 16, format: 'float32x4' }, // Model Matrix R1
              { shaderLocation: 5, offset: 32, format: 'float32x4' }, // Model Matrix R2
              { shaderLocation: 6, offset: 48, format: 'float32x4' }, // Model Matrix R3
              { shaderLocation: 7, offset: 64, format: 'float32x4' }, // Normal Matrix R0
              { shaderLocation: 8, offset: 80, format: 'float32x4' }, // Normal Matrix R1
              { shaderLocation: 9, offset: 96, format: 'float32x4' }, // Normal Matrix R2
              { shaderLocation: 10, offset: 112, format: 'float32x4' } // Normal Matrix R3
            ]
          }
        ]
      },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
    });

    // Global Uniform Buffer (144 bytes)
    this.cameraBuffer = this.device.createBuffer({
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Instance Data Buffer
    this.instanceBuffer = this.device.createBuffer({
      size: maxEntities * 32 * 4, // 10k entities * 32 floats * 4 bytes
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.cameraBindGroup = this.device.createBindGroup({
      layout: envLayout,
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }]
    });

    this.renderPassDescriptor = {
      colorAttachments: [{
        view: null as unknown as GPUTextureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture!.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
  }

  private createDepthTexture(width: number, height: number): void {
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device!.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  public renderFrame(instanceData: Float32Array, instanceCount: number, globalEnvData: Float32Array, mesh: SStaticMesh): void {
    if (!this.device || !this.context || !this.renderPassDescriptor || !this.renderPipeline || !this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.floor(this.canvas.clientWidth * dpr);
    const targetH = Math.floor(this.canvas.clientHeight * dpr);

    if (this.currentWidth !== targetW || this.currentHeight !== targetH) {
      this.currentWidth = targetW;
      this.currentHeight = targetH;
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
      this.createDepthTexture(targetW, targetH);
      (this.renderPassDescriptor.depthStencilAttachment as GPURenderPassDepthStencilAttachment).view = this.depthTexture!.createView();
    }

    // Actualizar Uniforms (144 bytes)
    this.device.queue.writeBuffer(this.cameraBuffer!, 0, globalEnvData.buffer as ArrayBuffer, globalEnvData.byteOffset, 144);

    // Actualizar Datos de Instancia
    this.device.queue.writeBuffer(this.instanceBuffer!, 0, instanceData.buffer as ArrayBuffer, instanceData.byteOffset, instanceData.byteLength);

    const encoder = this.device.createCommandEncoder();
    const attachments = this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    attachments[0].view = this.context.getCurrentTexture().createView();
    (this.renderPassDescriptor.depthStencilAttachment as GPURenderPassDepthStencilAttachment).view = this.depthTexture!.createView();

    const pass = encoder.beginRenderPass(this.renderPassDescriptor);
    pass.setPipeline(this.renderPipeline);

    // Bindings
    pass.setBindGroup(0, this.cameraBindGroup!);

    // Vertex Buffers
    pass.setVertexBuffer(0, mesh.vertexBuffer);     // Geometría
    pass.setVertexBuffer(1, this.instanceBuffer!);  // Instancias (Matrices)

    // Index Buffer
    pass.setIndexBuffer(mesh.indexBuffer, 'uint16');

    pass.drawIndexed(mesh.indexCount, instanceCount);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  public getAspectRatio(): number {
    if (!this.canvas || this.canvas.clientHeight === 0) return 16 / 9;
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }

  public getDevice(): GPUDevice { return this.device!; }
}
