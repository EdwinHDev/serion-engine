import { SerionRHI } from './rhi/SerionRHI';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Orquestador principal encargado de la simulación y el renderizado.
 */
export class SerionEngine {
  private rhi: SerionRHI;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number = 0;

  constructor() {
    this.rhi = new SerionRHI();
  }

  /**
   * Inicia el motor de videojuegos.
   * @param canvas El canvas del Editor que se usará para el RHI.
   */
  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;

      console.log("Iniciando Serion Engine...");

      // 1. Inicializar Capa 0 (Hardware & RHI)
      await this.rhi.initialize(canvas);

      // 2. Configuración de Tiempo
      this.isRunning = true;
      this.lastTime = performance.now();

      // 3. Iniciar el Bucle Principal
      this.animationFrameId = requestAnimationFrame(this.loop);

      console.log("Serion Engine iniciado correctamente.");
    } catch (error) {
      console.error("Fallo crítico al iniciar Serion Engine:", error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Detiene el motor de videojuegos y cancela el bucle.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    console.log("Serion Engine detenido.");
  }

  /**
   * Bucle Principal del Motor (Tick System).
   * @param currentTime Tiempo actual en milisegundos (pasado por rAF).
   */
  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // --- CÁLCULO DE DELTA TIME ---
    // Convertimos a segundos para una simulación coherente.
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // --- SECCIÓN UPDATE (Simulación) ---
    // Aquí se ejecutarán los sistemas DOD, físicas e IA.
    // [TODO]: SWorld.tick(deltaTime)

    // --- SECCIÓN RENDER (Visualización) ---
    // Por ahora, solo limpiamos la pantalla con el estilo Unreal.
    this.rhi.clearScreen(0.1, 0.1, 0.1, 1.0);

    // Solicitar el siguiente frame
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Obtiene la instancia del RHI.
   */
  public getRHI(): SerionRHI {
    return this.rhi;
  }
}
