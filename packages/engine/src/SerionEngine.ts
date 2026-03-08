import { SerionRHI, SDrawCall } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';
import { GeometryRegistry } from './geometry/GeometryRegistry';
import { SStaticMeshComponent } from './components/SStaticMeshComponent';
import { SMaterialComponent } from './components/SMaterialComponent';
import { SMat4 } from './math/SMath';

/**
 * SerionEngine - Clase Maestra.
 * Capa 12: Cascaded Shadow Maps (CSM) y Multi-Pass RHI.
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

  // Stride 40 floats (160 bytes) - Capa 11
  private batchBuffer = new Float32Array(10000 * 40);
  // Extended Uniforms (72 floats / 288 bytes) - Capa 12.3
  private globalEnvData = new Float32Array(72);

  // Light Cam Zero-GC Helpers
  private lightView = new Float32Array(16);
  private lightOrtho0 = new Float32Array(16);
  private lightOrtho1 = new Float32Array(16);
  private lightPos = new Float32Array([0, 0, 0]);
  private lightTarget = new Float32Array([0, 0, 0]);
  private lightUp = new Float32Array([0, 0, 1]);

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
      cameraActor.setPosition(0, -900, 400);

      const mainCamera = new SCamera(cameraActor);
      this.cameraManager.setActiveCamera(mainCamera);
      this.freeCameraController = new FreeCameraController(mainCamera);

      // --- ESCENA SHOWCASE PBR ---
      const floor = this.activeWorld.spawnActor();
      floor.setScale(5000, 5000, 10);
      floor.setPosition(0, 0, -5);
      floor.staticMesh = new SStaticMeshComponent('Primitive_Plane');
      floor.material = new SMaterialComponent();
      floor.material.setColor(0.6, 0.6, 0.6);
      floor.material.setPBR(0.0, 0.7); // 0% Metálico, 70% Rugoso (Mate)

      // Figuras para proyectar sombras
      this.spawnShowcaseActor('Primitive_Cube', -400, 0, 150, [1.0, 0.8, 0.0], 1.0, 0.1);    // Oro
      this.spawnShowcaseActor('Primitive_Sphere', -200, 0, 150, [1.0, 0.1, 0.1], 0.0, 0.2); // Plástico
      this.spawnShowcaseActor('Primitive_Cylinder', 0, 0, 150, [0.9, 0.9, 0.9], 1.0, 0.4); // Aluminio
      this.spawnShowcaseActor('Primitive_Cone', 200, 0, 150, [0.1, 0.8, 0.2], 0.0, 0.9);   // Goma
      this.spawnShowcaseActor('Primitive_Capsule', 400, 0, 150, [1.0, 0.4, 0.2], 1.0, 0.15); // Cobre

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);

      Logger.info('ENGINE', "Capa 12: Cascaded Shadows Active.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico:", error as any);
      throw error;
    }
  }

  private spawnShowcaseActor(mesh: string, x: number, y: number, z: number, color: number[], met: number, rough: number) {
    const actor = this.activeWorld.spawnActor();
    actor.setPosition(x, y, z);
    actor.setScale(100, 100, 100);
    actor.staticMesh = new SStaticMeshComponent(mesh);
    actor.material = new SMaterialComponent();
    actor.material.setColor(color[0], color[1], color[2]);
    actor.material.setPBR(met, rough);
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.loop);

    try {
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      if (this.freeCameraController) this.freeCameraController.update(deltaTime);
      this.activeWorld.tick(deltaTime);

      const activeCamera = this.cameraManager.getActiveCamera();
      if (activeCamera) {
        activeCamera.aspectRatio = this.rhi.getAspectRatio();

        // 1. Camera Matrices
        this.globalEnvData.set(activeCamera.getViewProjectionMatrix(), 0);

        // 2. Light Projections (Cascades)
        const sunDirX = 0.5, sunDirY = 0.5, sunDirZ = -1.0;
        const mag = Math.sqrt(sunDirX * sunDirX + sunDirY * sunDirY + sunDirZ * sunDirZ);
        const lDirX = sunDirX / mag, lDirY = sunDirY / mag, lDirZ = sunDirZ / mag;

        // View Matrix de la Luz (Centrada en la cámara del jugador)
        this.lightPos[0] = activeCamera.actor.x;
        this.lightPos[1] = activeCamera.actor.y;
        this.lightPos[2] = activeCamera.actor.z;
        this.lightTarget[0] = this.lightPos[0] + lDirX;
        this.lightTarget[1] = this.lightPos[1] + lDirY;
        this.lightTarget[2] = this.lightPos[2] + lDirZ;
        SMat4.lookAt(this.lightView, this.lightPos, this.lightTarget, this.lightUp);

        // Cascade 0: Near Detail (15m)
        SMat4.ortho(this.lightOrtho0, -1500, 1500, -1500, 1500, -5000, 5000);
        SMat4.multiply(this.globalEnvData, this.lightOrtho0, this.lightView, 16);

        // Cascade 1: Far Environment (150m)
        SMat4.ortho(this.lightOrtho1, -15000, 15000, -15000, 15000, -20000, 20000);
        SMat4.multiply(this.globalEnvData, this.lightOrtho1, this.lightView, 32);

        // 3. Splits and Params (Offset 48)
        this.globalEnvData[48] = 1500.0; // 15m split
        this.globalEnvData[49] = 15000.0; // 150m split

        // 4. Camera Position (Offset 52)
        this.globalEnvData[52] = activeCamera.actor.x;
        this.globalEnvData[53] = activeCamera.actor.y;
        this.globalEnvData[54] = activeCamera.actor.z;
        this.globalEnvData[55] = 1.0; // Padding

        // 5. Sun Direction & Intensity (Offset 56)
        this.globalEnvData[56] = lDirX;
        this.globalEnvData[57] = lDirY;
        this.globalEnvData[58] = lDirZ;
        this.globalEnvData[59] = 120000.0; // Lux

        // 6. Sun Color & Ambient (Offset 60)
        this.globalEnvData[60] = 1.0;
        this.globalEnvData[61] = 0.98;
        this.globalEnvData[62] = 0.95;
        this.globalEnvData[63] = 1.0; // Ambient Intensity

        // 7. Sky Color (Offset 64)
        this.globalEnvData[64] = 0.15;
        this.globalEnvData[65] = 0.35;
        this.globalEnvData[66] = 0.75;
        this.globalEnvData[67] = 1.0; // Alpha/Padding

        // 8. Ground Color (Offset 68)
        this.globalEnvData[68] = 0.05;
        this.globalEnvData[69] = 0.05;
        this.globalEnvData[70] = 0.05;
        this.globalEnvData[71] = 1.0; // Alpha/Padding

        // Batch Rendering Pass
        this.renderPBRBatch();
      }
    } catch (e) {
      Logger.warn("ENGINE", "Error en frame CSM: " + e);
    }
  };

  private renderPBRBatch(): void {
    const rawTransforms = this.transformPool.getRawData();
    const actors = this.activeWorld.getActors();

    for (const mesh of this.geometryRegistry.getMeshes()) {
      this.meshInstanceCounts.set(mesh.id, 0);
    }
    for (const actor of actors.values()) {
      if (actor.staticMesh) {
        const id = actor.staticMesh.meshId;
        this.meshInstanceCounts.set(id, (this.meshInstanceCounts.get(id) || 0) + 1);
      }
    }

    let totalInstances = 0;
    let activeDrawCallCount = 0;
    for (const mesh of this.geometryRegistry.getMeshes()) {
      const count = this.meshInstanceCounts.get(mesh.id) || 0;
      if (count > 0) {
        const startOffsetFloats = totalInstances * 40;
        this.meshStartOffsets.set(mesh.id, startOffsetFloats);
        const drawCall = this.drawCallPool[activeDrawCallCount];
        drawCall.mesh = mesh;
        drawCall.count = count;
        drawCall.startOffsetBytes = startOffsetFloats * 4;
        activeDrawCallCount++;
        totalInstances += count;
      }
    }

    for (const actor of actors.values()) {
      if (actor.staticMesh) {
        const id = actor.staticMesh.meshId;
        const targetOffset = this.meshStartOffsets.get(id)!;

        SMat4.fromRotationTranslationScale(
          this.batchBuffer,
          rawTransforms.subarray(actor.id * 16 + 3, actor.id * 16 + 7),
          rawTransforms.subarray(actor.id * 16, actor.id * 16 + 3),
          rawTransforms.subarray(actor.id * 16 + 7, actor.id * 16 + 10),
          targetOffset
        );
        SMat4.invertTranspose4x4(this.batchBuffer, this.batchBuffer, targetOffset + 16, targetOffset);

        if (actor.material) {
          this.batchBuffer.set(actor.material.baseColor, targetOffset + 32);
          this.batchBuffer.set(actor.material.pbrParams, targetOffset + 36);
        } else {
          this.batchBuffer.set([1, 1, 1, 1, 0, 0.5, 0.5, 0], targetOffset + 32);
        }
        this.meshStartOffsets.set(id, targetOffset + 40);
      }
    }

    if (totalInstances > 0) {
      const activeView = this.batchBuffer.subarray(0, totalInstances * 40);
      this.rhi.renderFrame(this.drawCallPool, activeDrawCallCount, this.globalEnvData, activeView);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  public getRHI(): SerionRHI { return this.rhi; }
}
