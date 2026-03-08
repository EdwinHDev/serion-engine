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

  // [RECURSOS GPU]: Buffers y BindGroups para comunicación con Shaders
  private transformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;

  // [PERFORMANCE]: Descriptor pre-asignado para evitar GC durante el loop de renderizado.
  private renderPassDescriptor: GPURenderPassDescriptor | null = null;

  /**
   * Inicializa el hardware gráfico y configura el contexto del canvas.
   * @param canvas El elemento HTMLCanvasElement que servirá como viewport.
   * @param maxEntities Límite de entidades para dimensionar los buffers de VRAM.
   */
  public async initialize(canvas: HTMLCanvasElement, maxEntities: number): Promise<void> {
    if (!navigator.gpu) {
      const msg = "WebGPU no está soportado en este navegador.";
      Logger.fatal('RHI', msg);
      throw new Error(msg);
    }

    // 1. Solicitar Adaptador
    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!this.adapter) {
      const msg = "No se pudo encontrar un adaptador de GPU compatible.";
      Logger.fatal('RHI', msg);
      throw new Error(msg);
    }

    // [AUDITORÍA DE HARDWARE]: Identificar la GPU real asignada por el sistema.
    const adapterInfo = this.adapter.info;
    Logger.info('RHI', `Hardware de Video: ${adapterInfo.vendor} - ${adapterInfo.architecture}`);

    // 2. Solicitar Dispositivo
    this.device = await this.adapter.requestDevice();

    if (!this.device) {
      const msg = "No se pudo instanciar el dispositivo lógico de la GPU.";
      Logger.fatal('RHI', msg);
      throw new Error(msg);
    }

    // 3. Configurar el Contexto del Canvas
    this.context = canvas.getContext('webgpu');
    if (!this.context) {
      const msg = "No se pudo obtener el contexto WebGPU del canvas.";
      Logger.fatal('RHI', msg);
      throw new Error(msg);
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();

    // Manejo de DPI (Device Pixel Ratio) para nitidez absoluta
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    // 4. Crear Pipeline de Renderizado (El Primer Triángulo)
    const shaderModule = this.device.createShaderModule({
      label: 'Basic Triangle Shader',
      code: BasicShaderWGSL
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'Main Render Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // 5. Crear Recursos de Memoria GPU (Bridge DOD-GPU)
    // 16 floats * 4 bytes per float
    const bufferSize = maxEntities * 16 * 4;
    this.transformBuffer = this.device.createBuffer({
      label: 'Transform Storage Buffer',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // BindGroup 0: Comunicación de transformaciones
    this.bindGroup = this.device.createBindGroup({
      label: 'Main Transform BindGroup',
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.transformBuffer },
        },
      ],
    });

    // 6. Inicializar Descriptores Reciclables (Zero GC)
    this.renderPassDescriptor = {
      colorAttachments: [
        {
          view: null as unknown as GPUTextureView, // Se asignará en caliente
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    // Logger.info('RHI', `Inicializado a ${canvas.width}x${canvas.height} (DPI: ${devicePixelRatio})`);
  }

  /**
   * Procesa un frame de renderizado instanciado.
   * @param transformArray Array crudo del TransformPool.
   * @param instanceCount Cantidad de instancias activas para dibujar.
   */
  public renderFrame(transformArray: Float32Array, instanceCount: number): void {
    if (!this.device || !this.context || !this.renderPassDescriptor || !this.renderPipeline || !this.transformBuffer || !this.bindGroup) {
      Logger.error('RHI', "Intento de renderizado sin inicializar recursos.");
      throw new Error("RHI no inicializado. Llama a initialize() primero.");
    }

    // 1. Actualizar VRAM con los datos de la CPU
    this.device.queue.writeBuffer(
      this.transformBuffer,
      0,
      transformArray.buffer as ArrayBuffer,
      transformArray.byteOffset,
      transformArray.byteLength
    );

    const commandEncoder = this.device.createCommandEncoder();

    // [OPTIMIZACIÓN]: Reutilización de descriptor. Prohibido usar {} o new.
    const attachments = this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    const colorAttachment = attachments[0];
    colorAttachment.view = this.context.getCurrentTexture().createView();

    // Fondo Unreal-Style por defecto
    const clearValue = colorAttachment.clearValue as GPUColorDict;
    clearValue.r = 0.1;
    clearValue.g = 0.1;
    clearValue.b = 0.1;
    clearValue.a = 1.0;

    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    // --- COMANDOS DE DIBUJO ---
    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.setBindGroup(0, this.bindGroup);

    // Dibujo Instanciado: 3 vértices por cada actor activo.
    passEncoder.draw(3, instanceCount);

    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Obtiene el dispositivo GPU actual.
   */
  public getDevice(): GPUDevice {
    if (!this.device) {
      Logger.error('RHI', "GET DEVICE - No inicializado");
      throw new Error("GPUDevice no inicializado.");
    }
    return this.device;
  }
}
