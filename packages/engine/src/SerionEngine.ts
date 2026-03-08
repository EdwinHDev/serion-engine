import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';

/**
 * SerionEngine - Clase Maestra del Motor.
 */
export class SerionEngine {
  public readonly transformPool: TransformPool;
  public readonly activeWorld: SWorld;
  public readonly cameraManager: CameraManager;

  private rhi: SerionRHI;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number = 0;

  private freeCameraController: FreeCameraController | null = null;

  // [GEOMETRY]: Cubo 3D Estándar
  private static readonly CUBE_GEOMETRY = new Float32Array([
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  ]);

  constructor() {
    this.rhi = new SerionRHI();
    this.cameraManager = new CameraManager();

    const maxEntities = 10100;
    this.transformPool = new TransformPool(maxEntities);
    this.activeWorld = new SWorld(this, maxEntities);

    Logger.info('ENGINE', "Motor inicializado.");
  }

  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;
      await this.rhi.initialize(canvas, this.transformPool.maxEntities, SerionEngine.CUBE_GEOMETRY);

      // --- CONFIGURACIÓN DE CÁMARA (Estilo Unreal) ---
      const cameraActor = this.activeWorld.spawnActor();
      cameraActor.setPosition(0, -20, 10);

      const mainCamera = new SCamera(cameraActor);
      mainCamera.aspectRatio = canvas.width / canvas.height;

      this.cameraManager.setActiveCamera(mainCamera);
      this.freeCameraController = new FreeCameraController(mainCamera);

      // Stress Test Grid
      const gridSide = 100;
      const spacing = 2.0;
      const offset = (gridSide * spacing) / 2;

      for (let i = 0; i < gridSide; i++) {
        for (let j = 0; j < gridSide; j++) {
          const actor = this.activeWorld.spawnActor();
          actor.setPosition((i * spacing) - offset, (j * spacing) - offset, 0);
          actor.setScale(0.8, 0.8, 0.8);
        }
      }

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);
      Logger.info('ENGINE', "Bucle iniciado con sistema de cámaras desacoplado.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico al iniciar Engine:", error as any);
      throw error;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Actualizar Controladores
    if (this.freeCameraController) {
      this.freeCameraController.update(deltaTime);
    }

    // Tick de Mundo
    this.activeWorld.tick(deltaTime);

    // Renderizado
    const activeCamera = this.cameraManager.getActiveCamera();
    if (activeCamera) {
      const viewProjMat = activeCamera.getViewProjectionMatrix();
      const activeCount = this.activeWorld.getEntityManager().getActiveCount();

      if (activeCount > 0) {
        this.rhi.renderFrame(this.transformPool.getRawData(), activeCount, viewProjMat);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  public getRHI(): SerionRHI { return this.rhi; }
}
