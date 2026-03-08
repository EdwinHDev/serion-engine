import { SerionRHI, SDrawCall } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';
import { GeometryRegistry } from './geometry/GeometryRegistry';
import { SStaticMeshComponent } from './components/SStaticMeshComponent';
import { SMat4 } from './math/SMath';

/**
 * SerionEngine - Clase Maestra del Motor.
 * Capa 10.5: Zero-GC Optimization y 3-Pass DOD Render Builder.
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

  // Buffers pre-alocados para Zero-GC
  private batchBuffer = new Float32Array(10000 * 32);
  private globalEnvData = new Float32Array(36);

  // Pools de apoyo para el 3-Pass Builder
  private meshInstanceCounts = new Map<string, number>();
  private meshStartOffsets = new Map<string, number>();
  private drawCallPool: SDrawCall[] = Array.from({ length: 50 }, () => ({ mesh: null as any, count: 0, startOffsetBytes: 0 }));

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

      // Showcase Camera
      const cameraActor = this.activeWorld.spawnActor();
      cameraActor.setPosition(0, -800, 300);

      const mainCamera = new SCamera(cameraActor);
      this.cameraManager.setActiveCamera(mainCamera);
      this.freeCameraController = new FreeCameraController(mainCamera);

      // --- ESCENA SHOWCASE ---
      const floor = this.activeWorld.spawnActor();
      floor.setScale(2000, 2000, 1);
      floor.setPosition(0, 0, 0);
      floor.staticMesh = new SStaticMeshComponent('Primitive_Plane');

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

      Logger.info('ENGINE', "Capa 10.5: Zero-GC DOD Builder active.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico:", error as any);
      throw error;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (this.freeCameraController) this.freeCameraController.update(deltaTime);
    this.activeWorld.tick(deltaTime);

    const activeCamera = this.cameraManager.getActiveCamera();
    if (activeCamera) {
      activeCamera.aspectRatio = this.rhi.getAspectRatio();

      // --- GLOBAL ENVIRONMENT ---
      this.globalEnvData.set(activeCamera.getViewProjectionMatrix(), 0);
      this.globalEnvData[16] = activeCamera.actor.x;
      this.globalEnvData[17] = activeCamera.actor.y;
      this.globalEnvData[18] = activeCamera.actor.z;

      // Sun (Zero-GC Math)
      const sunX = 0.5, sunY = 0.5, sunZ = -1.0;
      const mag = Math.sqrt(sunX * sunX + sunY * sunY + sunZ * sunZ);
      this.globalEnvData[20] = sunX / mag;
      this.globalEnvData[21] = sunY / mag;
      this.globalEnvData[22] = sunZ / mag;
      this.globalEnvData[23] = 100000.0; // Lux

      this.globalEnvData[24] = 1.0; this.globalEnvData[25] = 0.95; this.globalEnvData[26] = 0.9;
      this.globalEnvData[27] = 1.0; // Ambient Int
      this.globalEnvData[28] = 0.2; this.globalEnvData[29] = 0.4; this.globalEnvData[30] = 0.8;
      this.globalEnvData[32] = 0.1; this.globalEnvData[33] = 0.08; this.globalEnvData[34] = 0.05;

      // --- BATCH RENDERING (3-Pass DOD Linear Builder) ---
      const rawTransforms = this.transformPool.getRawData();
      const actors = this.activeWorld.getActors();

      // Pass 1: Contar instancias por malla (O(A))
      for (const mesh of this.geometryRegistry.getMeshes()) {
        this.meshInstanceCounts.set(mesh.id, 0);
      }
      for (const actor of actors.values()) {
        if (actor.staticMesh) {
          const id = actor.staticMesh.meshId;
          this.meshInstanceCounts.set(id, (this.meshInstanceCounts.get(id) || 0) + 1);
        }
      }

      // Pass 2: Asignar offsets y armar DrawCalls (O(M))
      let totalInstances = 0;
      let activeDrawCallCount = 0;
      for (const mesh of this.geometryRegistry.getMeshes()) {
        const count = this.meshInstanceCounts.get(mesh.id) || 0;
        if (count > 0) {
          const startOffsetFloats = totalInstances * 32;
          this.meshStartOffsets.set(mesh.id, startOffsetFloats);

          const drawCall = this.drawCallPool[activeDrawCallCount];
          drawCall.mesh = mesh;
          drawCall.count = count;
          drawCall.startOffsetBytes = startOffsetFloats * 4;
          activeDrawCallCount++;

          totalInstances += count;
        }
      }

      // Pass 3: Rellenar Buffer Secuencialmente (O(A))
      for (const actor of actors.values()) {
        if (actor.staticMesh) {
          const id = actor.staticMesh.meshId;
          const targetOffset = this.meshStartOffsets.get(id)!;

          SMat4.fromRotationTranslationScale(
            this.batchBuffer,
            rawTransforms.subarray(actor.id * 16 + 3, actor.id * 16 + 7), // Rot
            rawTransforms.subarray(actor.id * 16, actor.id * 16 + 3),      // Pos
            rawTransforms.subarray(actor.id * 16 + 7, actor.id * 16 + 10), // Scale
            targetOffset
          );
          SMat4.invertTranspose4x4(this.batchBuffer, this.batchBuffer, targetOffset + 16, targetOffset);

          this.meshStartOffsets.set(id, targetOffset + 32);
        }
      }

      if (totalInstances > 0) {
        const activeView = this.batchBuffer.subarray(0, totalInstances * 32);
        this.rhi.renderFrame(this.drawCallPool, activeDrawCallCount, this.globalEnvData, activeView);
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
