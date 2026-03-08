import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';
import { GeometryRegistry } from './geometry/GeometryRegistry';
import { SStaticMeshComponent } from './components/SStaticMeshComponent';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Capa 9: Batch Rendering y Escena Showcase.
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

  // Buffer temporal para batching de instancias (10k entidades * 16 floats)
  private batchBuffer = new Float32Array(10000 * 16);

  constructor() {
    this.rhi = new SerionRHI();
    this.cameraManager = new CameraManager();
    this.geometryRegistry = new GeometryRegistry();

    const maxEntities = 10100;
    this.transformPool = new TransformPool(maxEntities);
    this.activeWorld = new SWorld(this, maxEntities);

    Logger.info('ENGINE', "Motor inicializado.");
  }

  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;

      await this.rhi.initialize(canvas, this.transformPool.maxEntities);
      this.geometryRegistry.initialize(this.rhi.getDevice());

      // 1. Configuración de Cámara Showcase
      const cameraActor = this.activeWorld.spawnActor();
      cameraActor.setPosition(0, -800, 300);

      const mainCamera = new SCamera(cameraActor);
      this.cameraManager.setActiveCamera(mainCamera);
      this.freeCameraController = new FreeCameraController(mainCamera);

      // 2. ESCENA SHOWCASE

      // El Suelo (Plane)
      const floor = this.activeWorld.spawnActor();
      floor.setScale(2000, 2000, 1);
      floor.setPosition(0, 0, 0);
      floor.staticMesh = new SStaticMeshComponent('Primitive_Plane');

      // Las 5 Primitivas Volumétricas
      const meshIds = [
        'Primitive_Cube',
        'Primitive_Sphere',
        'Primitive_Cylinder',
        'Primitive_Cone',
        'Primitive_Capsule'
      ];

      for (let i = 0; i < meshIds.length; i++) {
        const actor = this.activeWorld.spawnActor();
        actor.setPosition((i - 2) * 200, 0, 150);
        actor.setScale(100, 100, 100);
        actor.staticMesh = new SStaticMeshComponent(meshIds[i]);
      }

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);

      Logger.info('ENGINE', "Showcase ready. Batch Rendering active.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico al iniciar Engine:", error as any);
      throw error;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (this.freeCameraController) {
      this.freeCameraController.update(deltaTime);
    }

    this.activeWorld.tick(deltaTime);

    const activeCamera = this.cameraManager.getActiveCamera();
    if (activeCamera) {
      activeCamera.aspectRatio = this.rhi.getAspectRatio();
      const viewProjMat = activeCamera.getViewProjectionMatrix();

      // --- BATCH RENDERING ---
      const meshIds = this.geometryRegistry.getMeshIds();
      const rawTransforms = this.transformPool.getRawData();
      const actors = this.activeWorld.getActors();

      for (const meshId of meshIds) {
        const mesh = this.geometryRegistry.getMesh(meshId);
        if (!mesh) continue;

        let instanceCount = 0;

        // Iterar sobre todos los actores del mundo
        for (const actor of actors.values()) {
          if (actor.staticMesh?.meshId === meshId) {
            const sourceOffset = actor.id * 16;
            const targetOffset = instanceCount * 16;

            for (let m = 0; m < 16; m++) {
              this.batchBuffer[targetOffset + m] = rawTransforms[sourceOffset + m];
            }
            instanceCount++;
          }
        }

        if (instanceCount > 0) {
          const activeData = this.batchBuffer.subarray(0, instanceCount * 16);
          this.rhi.renderFrame(activeData, instanceCount, viewProjMat, mesh);
          // this.rhi.renderFrame(this.batchBuffer, instanceCount, viewProjMat, mesh);
        }
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
