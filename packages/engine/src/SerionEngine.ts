import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { SMat4 } from './math/SMath';

/**
 * SerionEngine - Clase Maestra del Motor.
 */
export class SerionEngine {
  public readonly transformPool: TransformPool;
  public readonly activeWorld: SWorld;
  private rhi: SerionRHI;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number = 0;

  // Buffers de matrices (Zero GC)
  private viewMat = new Float32Array(16);
  private projMat = new Float32Array(16);
  private viewProjMat = new Float32Array(16);

  constructor() {
    this.rhi = new SerionRHI();
    const maxEntities = 10000; // Incrementado para el Stress Test
    this.transformPool = new TransformPool(maxEntities);
    this.activeWorld = new SWorld(this, maxEntities);

    Logger.info('ENGINE', `TransformPool inicializado para ${maxEntities} entidades.`);
  }

  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;
      await this.rhi.initialize(canvas, this.transformPool.maxEntities);

      // --- HITO: STRESS TEST (10k ACTORES) ---
      Logger.info('ENGINE', "Ejecutando Stress Test: Spawning 10,000 actores...");

      const gridSide = 100;
      const spacing = 1.0;
      const startPos = -(gridSide * spacing) / 2;

      for (let i = 0; i < gridSide; i++) {
        for (let j = 0; j < gridSide; j++) {
          const actor = this.activeWorld.spawnActor();
          const x = startPos + (i * spacing);
          const y = startPos + (j * spacing);
          const z = Math.sin(i * 0.2) * Math.cos(j * 0.2) * 2.0; // Terreno ondulado

          actor.setPosition(x, y, z);
          actor.setScale(0.4, 0.4, 0.4);
        }
      }

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);
      Logger.info('ENGINE', "Stress Test iniciado. 10,000 entidades activas.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo al iniciar:", error as any);
      throw error;
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.activeWorld.tick(deltaTime);

    // Calcular Cámara (Z-Up Perspective)
    // Cámara elevada para ver la rejilla completa
    const aspect = window.innerWidth / window.innerHeight;
    SMat4.perspective(this.projMat, 45 * Math.PI / 180, aspect, 0.1, 2000);

    // Elevamos la cámara a 80 unidades en Y (atrás) y 50 en Z (arriba)
    SMatrix4_LookAtFixed(this.viewMat, [0, -80, 50], [0, 0, 0], [0, 0, 1]);

    SMat4.multiply(this.viewProjMat, this.projMat, this.viewMat);

    const activeCount = this.activeWorld.getEntityManager().getActiveCount();
    if (activeCount > 0) {
      this.rhi.renderFrame(this.transformPool.getRawData(), activeCount, this.viewProjMat);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public getRHI(): SerionRHI { return this.rhi; }
}

/**
 * Helder temporal para asegurar que SMat4.lookAt se porta bien.
 * (Nota: Usamos SMat4.lookAt directamente si confiamos en los cambios previos)
 */
function SMatrix4_LookAtFixed(out: Float32Array, eye: number[], target: number[], up: number[]): void {
  SMat4.lookAt(out, eye, target, up);
}
