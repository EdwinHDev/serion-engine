import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';
import { SStaticMesh } from '../geometry/SStaticMesh';

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Versión 4: Soporte para Vertex Layout Entrelazado y Indexed Drawing.
 */
export class SerionRHI {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private renderPipeline: GPURenderPipeline | null = null;

  private cameraBuffer: GPUBuffer | null = null;
  private transformBuffer: GPUBuffer | null = null;
  private cameraBindGroup: GPUBindGroup | null = null;
  private transformBindGroup: GPUBindGroup | null = null;

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

    // Layouts
    const cameraLayout = this.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }]
    });

    const transformLayout = this.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }]
    });

    const shaderModule = this.device.createShaderModule({ code: BasicShaderWGSL });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [cameraLayout, transformLayout] });

    // Pipeline: Layout Entrelazado de 32 bytes
    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 32, // 8 floats * 4 bytes
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
            { shaderLocation: 1, offset: 12, format: 'float32x3' }, // Normal
            { shaderLocation: 2, offset: 24, format: 'float32x2' }  // UV
          ]
        }]
      },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
    });

    this.cameraBuffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.transformBuffer = this.device.createBuffer({ size: maxEntities * 16 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

    this.cameraBindGroup = this.device.createBindGroup({ layout: cameraLayout, entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }] });
    this.transformBindGroup = this.device.createBindGroup({ layout: transformLayout, entries: [{ binding: 0, resource: { buffer: this.transformBuffer } }] });

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

  public renderFrame(transformArray: Float32Array, instanceCount: number, viewProj: Float32Array, mesh: SStaticMesh): void {
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

    this.device.queue.writeBuffer(this.cameraBuffer!, 0, viewProj.buffer as ArrayBuffer, viewProj.byteOffset, viewProj.byteLength);
    this.device.queue.writeBuffer(this.transformBuffer!, 0, transformArray.buffer as ArrayBuffer, transformArray.byteOffset, transformArray.byteLength);

    const encoder = this.device.createCommandEncoder();
    const attachments = this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    attachments[0].view = this.context.getCurrentTexture().createView();
    (this.renderPassDescriptor.depthStencilAttachment as GPURenderPassDepthStencilAttachment).view = this.depthTexture!.createView();

    const pass = encoder.beginRenderPass(this.renderPassDescriptor);
    pass.setPipeline(this.renderPipeline);

    // --- DRAW INDEXED ---
    pass.setVertexBuffer(0, mesh.vertexBuffer);
    pass.setIndexBuffer(mesh.indexBuffer, 'uint16');
    pass.setBindGroup(0, this.cameraBindGroup!);
    pass.setBindGroup(1, this.transformBindGroup!);

    pass.drawIndexed(mesh.indexCount, instanceCount);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  public getDevice(): GPUDevice { return this.device!; }
}
