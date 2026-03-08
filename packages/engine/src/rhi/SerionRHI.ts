import { Logger } from '../utils/Logger';
import { BasicShaderWGSL } from './shaders/BasicShader.wgsl';

/**
 * Serion Engine - Rendering Hardware Interface (RHI)
 * Abstracción de WebGPU siguiendo principios SOLID.
 */
export class SerionRHI {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  // [PIPELINES]: Estados de renderizado pre-compilados
  private renderPipeline: GPURenderPipeline | null = null;

  // [RECURSOS GPU]: Buffers y BindGroups
  private cameraBuffer: GPUBuffer | null = null;
  private transformBuffer: GPUBuffer | null = null;
  private cameraBindGroup: GPUBindGroup | null = null;
  private transformBindGroup: GPUBindGroup | null = null;

  // [DEPTH]: Z-Buffer para oclusión correcta
  private depthTexture: GPUTexture | null = null;

  // [PERFORMANCE]: Descriptor pre-asignado (Zero GC)
  private renderPassDescriptor: GPURenderPassDescriptor | null = null;

  /**
   * Inicializa el hardware gráfico y configura el contexto.
   */
  public async initialize(canvas: HTMLCanvasElement, maxEntities: number): Promise<void> {
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

    // Manejo de DPI
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    // --- 1. Crear Textura de Profundidad (Z-Buffer) ---
    this.depthTexture = this.device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // --- 2. Definir Bind Group Layouts ---
    const cameraLayout = this.device.createBindGroupLayout({
      label: 'Camera Layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }]
    });

    const transformLayout = this.device.createBindGroupLayout({
      label: 'Transform Layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' }
      }]
    });

    // --- 3. Crear Pipeline con Depth Testing ---
    const shaderModule = this.device.createShaderModule({ code: BasicShaderWGSL });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [cameraLayout, transformLayout]
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });

    // --- 4. Crear Buffers ---
    this.cameraBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.transformBuffer = this.device.createBuffer({
      size: maxEntities * 16 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // --- 5. Crear Bind Groups ---
    this.cameraBindGroup = this.device.createBindGroup({
      layout: cameraLayout,
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }]
    });

    this.transformBindGroup = this.device.createBindGroup({
      layout: transformLayout,
      entries: [{ binding: 0, resource: { buffer: this.transformBuffer } }]
    });

    // --- 6. Descriptor (Zero GC) ---
    this.renderPassDescriptor = {
      colorAttachments: [{
        view: null as unknown as GPUTextureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
  }

  /**
   * Renderiza el frame actual.
   */
  public renderFrame(transformArray: Float32Array, instanceCount: number, viewProj: Float32Array): void {
    if (!this.device || !this.context || !this.renderPassDescriptor || !this.renderPipeline ||
      !this.cameraBuffer || !this.transformBuffer || !this.cameraBindGroup || !this.transformBindGroup || !this.depthTexture) return;

    // Actualizar VRAM
    this.device.queue.writeBuffer(
      this.cameraBuffer,
      0,
      viewProj.buffer as ArrayBuffer,
      viewProj.byteOffset,
      viewProj.byteLength
    );
    this.device.queue.writeBuffer(
      this.transformBuffer,
      0,
      transformArray.buffer as ArrayBuffer,
      transformArray.byteOffset,
      transformArray.byteLength
    );

    const encoder = this.device.createCommandEncoder();
    const attachments = this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    attachments[0].view = this.context.getCurrentTexture().createView();

    // El depthView debe estar disponible en el descriptor (podemos reutilizarlo si no cambia el canvas)
    // Pero por seguridad en redimensionamientos futuros lo podríamos actualizar aquí.

    const pass = encoder.beginRenderPass(this.renderPassDescriptor);
    pass.setPipeline(this.renderPipeline);
    pass.setBindGroup(0, this.cameraBindGroup);
    pass.setBindGroup(1, this.transformBindGroup);
    pass.draw(3, instanceCount);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  public getDevice(): GPUDevice { return this.device!; }
}
