import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { SMat4 } from './math/SMath';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Orquestador principal encargado de la simulación y el renderizado.
 */
export class SerionEngine {
  public readonly transformPool: TransformPool;
  public readonly activeWorld: SWorld;
  private rhi: SerionRHI;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number = 0;

  // [MATH]: Buffers de matrices pre-asignados (Zero GC)
  private viewMat = new Float32Array(16);
  private projMat = new Float32Array(16);
  private viewProjMat = new Float32Array(16);

  constructor() {
    this.rhi = new SerionRHI();

    // Inicializar Pool de Transformaciones (Capa 1 - DOD)
    const maxEntities = 10000;
    this.transformPool = new TransformPool(maxEntities);

    // Inicializar Mundo Activo (Capa 3 - Simulación)
    this.activeWorld = new SWorld(this, maxEntities);

    const memoryKB = (this.transformPool.getByteSize()) / 1024;
    Logger.info('ENGINE', `TransformPool inicializado: ${memoryKB} KB para ${maxEntities} entidades.`);
  }

  /**
   * Inicia el motor de videojuegos.
   */
  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;

      Logger.info('ENGINE', "Iniciando Serion Engine...");

      // 1. Inicializar Hardware & RHI
      await this.rhi.initialize(canvas, this.transformPool.maxEntities);

      // --- HITO: STRESS TEST (10,000 ACTORES) ---
      // Creamos una alfombra ondulante de 100x100 para validar el rendimiento.
      Logger.info('ENGINE', "Ejecutando Stress Test: Spawning 10,000 actores...");

      const gridSide = 100;
      const spacing = 2.0; // Espaciado refinado para mejor visibilidad
      const offset = (gridSide * spacing) / 2;

      for (let i = 0; i < gridSide; i++) {
        for (let j = 0; j < gridSide; j++) {
          const actor = this.activeWorld.spawnActor();
          const x = (i * spacing) - offset;
          const y = (j * spacing) - offset;

          // Elevación dinámica inicial (opcional, se actualizará en tick si hay lógica)
          const z = Math.sin(i * 0.2) * Math.cos(j * 0.2) * 2.0;

          actor.setPosition(x, y, z);
          actor.setScale(0.5, 0.5, 0.5);
        }
      }

      // 2. Configuración de Tiempo
      this.isRunning = true;
      this.lastTime = performance.now();

      // 3. Iniciar el Bucle Principal
      this.animationFrameId = requestAnimationFrame(this.loop);

      Logger.info('ENGINE', "Serion Engine iniciado con 10,000 entidades activas.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico al iniciar Serion Engine:", error as any);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Detiene el motor de videojuegos.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    Logger.info('ENGINE', "Serion Engine detenido.");
  }

  /**
   * Bucle Principal (Tick System).
   */
  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // --- CÁLCULO DE DELTA TIME ---
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // --- SECCIÓN UPDATE ---
    this.activeWorld.tick(deltaTime);

    // --- SECCIÓN RENDER ---

    // 1. Calcular Cámara (Z-Up Perspective)
    const aspect = window.innerWidth / window.innerHeight;
    SMat4.perspective(this.projMat, 45 * Math.PI / 180, aspect, 0.1, 2000.0);

    // Elevamos la cámara a una posición de observación aérea (Pos: [0, -100, 60] Mirando al centro)
    SMat4.lookAt(this.viewMat, [0, -100, 60], [0, 0, 0], [0, 0, 1]);

    // Combinar View-Projection
    SMat4.multiply(this.viewProjMat, this.projMat, this.viewMat);

    // 2. Renderizar Actores
    const activeCount = this.activeWorld.getEntityManager().getActiveCount();
    if (activeCount > 0) {
      this.rhi.renderFrame(
        this.transformPool.getRawData(),
        activeCount,
        this.viewProjMat
      );
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public getRHI(): SerionRHI {
    return this.rhi;
  }
}
