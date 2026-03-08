import { SerionRHI } from './rhi/SerionRHI';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Orquestador principal encargado de la simulación y el renderizado.
 */
export class SerionEngine {
  private rhi: SerionRHI;

  constructor() {
    this.rhi = new SerionRHI();
  }

  /**
   * Inicia el motor de videojuegos.
   * @param canvas El canvas del Editor que se usará para el RHI.
   */
  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      console.log("Iniciando Serion Engine...");

      // 1. Inicializar Capa 0 (Hardware & RHI)
      await this.rhi.initialize(canvas);

      // 2. Primer Frame: Clear Screen (Estilo Unreal Engine Dark Grey)
      // Color: #1A1A1A -> r: 0.1, g: 0.1, b: 0.1
      this.rhi.clearScreen(0.1, 0.1, 0.1, 1.0);

      console.log("Serion Engine iniciado correctamente.");
    } catch (error) {
      console.error("Fallo crítico al iniciar Serion Engine:", error);
      throw error;
    }
  }

  /**
   * Obtiene la instancia del RHI.
   */
  public getRHI(): SerionRHI {
    return this.rhi;
  }
}
