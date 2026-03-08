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

  // [PERFORMANCE]: Descriptor pre-asignado para evitar GC durante el loop de renderizado.
  private renderPassDescriptor: GPURenderPassDescriptor | null = null;

  /**
   * Inicializa el hardware gráfico y configura el contexto del canvas.
   * @param canvas El elemento HTMLCanvasElement que servirá como viewport.
   */
  public async initialize(canvas: HTMLCanvasElement): Promise<void> {
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

    // 5. Inicializar Descriptores Reciclables (Zero GC)
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
   * Limpia la pantalla y dibuja el triángulo de validación.
   * @param r Rojo (0.0 - 1.0)
   * @param g Verde (0.0 - 1.0)
   * @param b Azul (0.0 - 1.0)
   * @param a Alpha (0.0 - 1.0)
   */
  public clearScreen(r: number, g: number, b: number, a: number): void {
    if (!this.device || !this.context || !this.renderPassDescriptor || !this.renderPipeline) {
      Logger.error('RHI', "Intento de renderizado sin inicializar pipeline.");
      throw new Error("RHI no inicializado. Llama a initialize() primero.");
    }

    const commandEncoder = this.device.createCommandEncoder();

    // [OPTIMIZACIÓN]: Reutilización de descriptor. Prohibido usar {} o new.
    const attachments = this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[];
    const colorAttachment = attachments[0];
    colorAttachment.view = this.context.getCurrentTexture().createView();

    const clearValue = colorAttachment.clearValue as GPUColorDict;
    clearValue.r = r;
    clearValue.g = g;
    clearValue.b = b;
    clearValue.a = a;

    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);

    // --- COMANDOS DE DIBUJO ---
    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.draw(3); // 3 vértices definidos en el shader

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
