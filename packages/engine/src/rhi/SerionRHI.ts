import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Abstracción de WebGPU siguiendo principios SOLID.
 * Versión 3: Soporte para Vertex Buffers, Depth Testing y Gestión Dinámica de Resolución.
 */
export class SerionRHI {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  // [RECURSOS GPU]: Pipelines y Buffers
  private renderPipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private vertexCount: number = 0;

  private cameraBuffer: GPUBuffer | null = null;
  private transformBuffer: GPUBuffer | null = null;
  private cameraBindGroup: GPUBindGroup | null = null;
  private transformBindGroup: GPUBindGroup | null = null;

  // [DEPTH]: Z-Buffer
  private depthTexture: GPUTexture | null = null;

  // [ESTADO]: Seguimiento de resolución para sincronización atómica
  private currentWidth = 0;
  private currentHeight = 0;

  // [PERFORMANCE]: Descriptor Zero GC
  private renderPassDescriptor: GPURenderPassDescriptor | null = null;

  /**
   * Inicializa el hardware gráfico y carga la geometría base.
   */
  public async initialize(canvas: HTMLCanvasElement, maxEntities: number, geometry: Float32Array): Promise<void> {
    this.canvas = canvas;
    this.vertexCount = geometry.length / 3;

    if (!navigator.gpu) {
      Logger.fatal('RHI', "WebGPU no soportado.");
      throw new Error("WebGPU no soportado.");
    }

    this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!this.adapter) throw new Error("No adapter found.");

    const adapterInfo = this.adapter.info;
    Logger.info('RHI', `Hardware: ${adapterInfo.vendor} - ${adapterInfo.architecture}`);

    this.device = await this.adapter.requestDevice();
    if (!this.device) throw new Error("No device found.");

    this.context = canvas.getContext('webgpu');
    if (!this.context) throw new Error("No context found.");

    this.format = navigator.gpu.getPreferredCanvasFormat();

    // 1. Configuración de Resolución e Inicialización de Z-Buffer
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

    // 2. Definir Layouts Explícitos
    const cameraLayout = this.device.createBindGroupLayout({
      label: 'Camera Layout',
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }]
    });

    const transformLayout = this.device.createBindGroupLayout({
      label: 'Transform Layout',
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }]
    });

    // 3. Crear Vertex Buffer
    this.vertexBuffer = this.device.createBuffer({
      label: 'Static Geometry Buffer',
      size: geometry.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      this.vertexBuffer,
      0,
      geometry.buffer as ArrayBuffer,
      geometry.byteOffset,
      geometry.byteLength
    );

    // 4. Crear Pipeline con soporte para Vertex Buffers y Depth
    const shaderModule = this.device.createShaderModule({ code: BasicShaderWGSL });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [cameraLayout, transformLayout] });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 12, // 3 floats * 4 bytes
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        }]
      },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
    });

    // 5. Crear Buffers de Comunicación
    this.cameraBuffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.transformBuffer = this.device.createBuffer({ size: maxEntities * 16 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

    // 6. Vincular Bind Groups
    this.cameraBindGroup = this.device.createBindGroup({ layout: cameraLayout, entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }] });
    this.transformBindGroup = this.device.createBindGroup({ layout: transformLayout, entries: [{ binding: 0, resource: { buffer: this.transformBuffer } }] });

    // 7. Descriptor Reutilizable
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

  public renderFrame(transformArray: Float32Array, instanceCount: number, viewProj: Float32Array): void {
    if (!this.device || !this.context || !this.renderPassDescriptor || !this.renderPipeline || !this.canvas) return;

    // Sincronización de Resolución (Resizing robusto)
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

    // Subida de datos a VRAM con casting explícito de tipos
    this.device.queue.writeBuffer(this.cameraBuffer!, 0, viewProj.buffer as ArrayBuffer, viewProj.byteOffset, viewProj.byteLength);
    this.device.queue.writeBuffer(this.transformBuffer!, 0, transformArray.buffer as ArrayBuffer, transformArray.byteOffset, transformArray.byteLength);

    const encoder = this.device.createCommandEncoder();
    const attachments = this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    attachments[0].view = this.context.getCurrentTexture().createView();

    // Sincronización final de vista de profundidad
    (this.renderPassDescriptor.depthStencilAttachment as GPURenderPassDepthStencilAttachment).view = this.depthTexture!.createView();

    const pass = encoder.beginRenderPass(this.renderPassDescriptor);
    pass.setPipeline(this.renderPipeline);

    // Activar Vertex Buffer y Bind Groups
    pass.setVertexBuffer(0, this.vertexBuffer!);
    pass.setBindGroup(0, this.cameraBindGroup!);
    pass.setBindGroup(1, this.transformBindGroup!);

    // Instanced Draw masivo
    pass.draw(this.vertexCount, instanceCount);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  public getDevice(): GPUDevice { return this.device!; }
}
