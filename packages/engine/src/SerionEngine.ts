import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';
import { GeometryRegistry } from './geometry/GeometryRegistry';
import { SStaticMeshComponent } from './components/SStaticMeshComponent';
import { SMat4 } from './math/SMath';
import { SDrawCall } from './rhi/SerionRHI';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Capa 10: Iluminación PBR y Matriz Normal.
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

  // Buffer temporal para batching (10k entidades * 32 floats [Model + Normal])
  private batchBuffer = new Float32Array(10000 * 32);

  // Buffer Global Environment (144 bytes / 4 = 36 floats)
  private globalEnvData = new Float32Array(36);

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

      Logger.info('ENGINE', "Capa 10: PBR Lighting ready.");
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

      // --- CONFIGURACIÓN GLOBAL ENVIRONMENT (144 bytes) ---
      // 1. View Projection Matrix (0-15)
      this.globalEnvData.set(activeCamera.getViewProjectionMatrix(), 0);

      // 2. Camera Position (16-18) + Pad (19)
      this.globalEnvData[16] = activeCamera.actor.x;
      this.globalEnvData[17] = activeCamera.actor.y;
      this.globalEnvData[18] = activeCamera.actor.z;
      this.globalEnvData[19] = 0.0; // Padding

      // 3. Sun Direction (20-22) + Intensity (23)
      const sunDir = [0.5, 0.5, -1.0];
      const mag = Math.sqrt(sunDir[0] * sunDir[0] + sunDir[1] * sunDir[1] + sunDir[2] * sunDir[2]);
      this.globalEnvData[20] = sunDir[0] / mag;
      this.globalEnvData[21] = sunDir[1] / mag;
      this.globalEnvData[22] = sunDir[2] / mag;
      this.globalEnvData[23] = 100000.0; // 100k Lux

      // 4. Sun Color (24-26) + Ambient Intensity (27)
      this.globalEnvData[24] = 1.0;
      this.globalEnvData[25] = 0.95;
      this.globalEnvData[26] = 0.9;
      this.globalEnvData[27] = 1.0;

      // 5. Sky Color (28-30) + Pad (31)
      this.globalEnvData[28] = 0.2;
      this.globalEnvData[29] = 0.4;
      this.globalEnvData[30] = 0.8;
      this.globalEnvData[31] = 0.0;

      // 6. Ground Color (32-34) + Pad (35)
      this.globalEnvData[32] = 0.1;
      this.globalEnvData[33] = 0.08;
      this.globalEnvData[34] = 0.05;
      this.globalEnvData[35] = 0.0;

      // --- BATCH RENDERING (Zero-GC Optimized) ---
      const rawTransforms = this.transformPool.getRawData();
      const actors = this.activeWorld.getActors();
      const drawCalls: SDrawCall[] = [];
      let totalInstances = 0;

      for (const mesh of this.geometryRegistry.getMeshes()) {
        let count = 0;
        const startOffsetBytes = totalInstances * 128; // 32 floats * 4 bytes

        for (const actor of actors.values()) {
          if (actor.staticMesh?.meshId === mesh.id) {
            const trOffset = actor.id * 16;
            const targetOffset = totalInstances * 32;

            // 1. Construir Matriz de Modelo real (16 floats) desde los componentes DOD
            // El pool tiene: [Pos_xyz (3), Rot_xyzw (4), Scale_xyz (3), Pad (6)] = 16 floats
            SMat4.fromRotationTranslationScale(
              this.batchBuffer,
              rawTransforms.subarray(trOffset + 3, trOffset + 7), // Rotación
              rawTransforms.subarray(trOffset, trOffset + 3),     // Posición
              rawTransforms.subarray(trOffset + 7, trOffset + 10), // Escala
              targetOffset
            );

            // 2. Calcular Matriz Normal (Inverse Transpose) - 16 floats
            SMat4.invertTranspose4x4(this.batchBuffer, this.batchBuffer, targetOffset + 16, targetOffset);

            totalInstances++;
            count++;
          }
        }

        if (count > 0) {
          drawCalls.push({ mesh, count, startOffsetBytes });
        }
      }

      if (totalInstances > 0) {
        const activeView = this.batchBuffer.subarray(0, totalInstances * 32);
        this.rhi.renderFrame(drawCalls, this.globalEnvData, activeView);
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
