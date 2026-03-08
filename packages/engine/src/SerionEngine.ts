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
    const maxEntities = 10000;
    this.transformPool = new TransformPool(maxEntities);
    this.activeWorld = new SWorld(this, maxEntities);

    Logger.info('ENGINE', `TransformPool inicializado para ${maxEntities} entidades.`);
  }

  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;
      await this.rhi.initialize(canvas, this.transformPool.maxEntities);

      // Setup 3D Pyramid
      const a1 = this.activeWorld.spawnActor(); a1.setPosition(0, 0, 1); a1.setScale(0.5, 0.5, 0.5);
      const a2 = this.activeWorld.spawnActor(); a2.setPosition(-1, 0, 0); a2.setScale(0.5, 0.5, 0.5);
      const a3 = this.activeWorld.spawnActor(); a3.setPosition(1, 0, 0); a3.setScale(0.5, 0.5, 0.5);

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);
      Logger.info('ENGINE', "Motor iniciado.");
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

    // Calcular Cámara (Z-Up)
    const aspect = 16 / 9; // TODO: Usar aspect real del canvas
    SMat4.perspective(this.projMat, 45 * Math.PI / 180, aspect, 0.1, 1000);
    SMat4.lookAt(this.viewMat, [0, -5, 2], [0, 0, 0], [0, 0, 1]);
    SMat4.multiply(this.viewProjMat, this.projMat, this.viewMat);

    const activeCount = this.activeWorld.getEntityManager().getActiveCount();
    if (activeCount > 0) {
      this.rhi.renderFrame(this.transformPool.getRawData(), activeCount, this.viewProjMat);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public getRHI(): SerionRHI { return this.rhi; }
}
