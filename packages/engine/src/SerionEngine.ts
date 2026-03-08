import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';
import { GeometryRegistry } from './geometry/GeometryRegistry';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Capa 8: Integración de GeometryRegistry y mallas estáticas.
 */
export class SerionEngine {
  public readonly transformPool: TransformPool;
  public readonly activeWorld: SWorld;
  public readonly cameraManager: CameraManager;
  public readonly geometryRegistry: GeometryRegistry;

  private rhi: SerionRHI;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number = 0;

  private freeCameraController: FreeCameraController | null = null;

  constructor() {
    this.rhi = new SerionRHI();
    this.cameraManager = new CameraManager();
    this.geometryRegistry = new GeometryRegistry();

    const maxEntities = 10100; // Incrementado para Stress Test + Cámaras
    this.transformPool = new TransformPool(maxEntities);
    this.activeWorld = new SWorld(this, maxEntities);

    Logger.info('ENGINE', "Motor inicializado.");
  }

  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;

      // 1. Inicializar RHI
      await this.rhi.initialize(canvas, this.transformPool.maxEntities);

      // 2. Inicializar Geometría a través del Registro
      this.geometryRegistry.initialize(this.rhi.getDevice());

      // 3. Configuración de Cámara
      const cameraActor = this.activeWorld.spawnActor();
      cameraActor.setPosition(0, -20, 10);

      const mainCamera = new SCamera(cameraActor);
      this.cameraManager.setActiveCamera(mainCamera);
      this.freeCameraController = new FreeCameraController(mainCamera);

      // 4. Stress Test Grid
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

      Logger.info('ENGINE', "Sistemas listos. Iniciando bucle de mallas estáticas.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico al iniciar Engine:", error as any);
      throw error;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Actualizar Cámara (UX Unreal Style)
    if (this.freeCameraController) {
      this.freeCameraController.update(deltaTime);
    }

    this.activeWorld.tick(deltaTime);

    const activeCamera = this.cameraManager.getActiveCamera();
    const cubeMesh = this.geometryRegistry.getMesh('Primitive_Cube');

    if (activeCamera && cubeMesh) {
      const viewProjMat = activeCamera.getViewProjectionMatrix();
      const activeCount = this.activeWorld.getEntityManager().getActiveCount();

      if (activeCount > 0) {
        this.rhi.renderFrame(this.transformPool.getRawData(), activeCount, viewProjMat, cubeMesh);
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
