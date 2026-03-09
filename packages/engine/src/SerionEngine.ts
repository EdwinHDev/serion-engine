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
import { SGlobalEnvironmentData } from './core/SGlobalEnvironmentData';
import { CascadedShadowManager } from './lighting/CascadedShadowManager';

/**
 * SerionEngine - Clase Maestra.
 * Capa 12.6: Gestor CSM Dinámico.
 */
export class SerionEngine {
  public readonly transformPool: TransformPool;
  public readonly activeWorld: SWorld;
  public readonly cameraManager: CameraManager;
  public readonly geometryRegistry: GeometryRegistry;
  public readonly globalEnvironment = new SGlobalEnvironmentData();

  private rhi: SerionRHI;
  private csmManager = new CascadedShadowManager();

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameid: number = 0;

  private freeCameraController: FreeCameraController | null = null;

  // Stride 40 floats (160 bytes)
  private batchBuffer = new Float32Array(10000 * 40);

  // Sun Vector (Dir Normalizada)
  private sunDirectionArray = new Float32Array([0.5, 0.5, -1.0]);

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

    // Normalizar sol inicial
    const d = this.sunDirectionArray;
    const mag = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    d[0] /= mag; d[1] /= mag; d[2] /= mag;

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
      floor.material.setPBR(0.0, 0.7);

      // Figuras para proyectar sombras
      this.spawnShowcaseActor('Primitive_Cube', -400, 0, 150, [1.0, 0.8, 0.0], 1.0, 0.1);    // Oro
      this.spawnShowcaseActor('Primitive_Sphere', -200, 0, 150, [1.0, 0.1, 0.1], 0.0, 0.2); // Plástico
      this.spawnShowcaseActor('Primitive_Cylinder', 0, 0, 150, [0.9, 0.9, 0.9], 1.0, 0.4); // Aluminio
      this.spawnShowcaseActor('Primitive_Cone', 200, 0, 150, [0.1, 0.8, 0.2], 0.0, 0.9);   // Goma
      this.spawnShowcaseActor('Primitive_Capsule', 400, 0, 150, [1.0, 0.4, 0.2], 1.0, 0.15); // Cobre

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameid = requestAnimationFrame(this.loop);

      Logger.info('ENGINE', "Capa 12.6: Gestor CSM Dinámico Activo.");
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
    this.animationFrameid = requestAnimationFrame(this.loop);

    try {
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      if (this.freeCameraController) this.freeCameraController.update(deltaTime);
      this.activeWorld.tick(deltaTime);

      const activeCamera = this.cameraManager.getActiveCamera();
      if (activeCamera) {
        activeCamera.aspectRatio = this.rhi.getAspectRatio();

        // 1. Matriz Cámara Jugador
        this.globalEnvironment.setViewProjectionMatrix(activeCamera.getViewProjectionMatrix());

        // 2. ACTUALIZACIÓN CSM DINÁMICA (Capa 12.6)
        this.csmManager.update(activeCamera, this.sunDirectionArray, this.globalEnvironment);

        // 3. Camera Position
        this.globalEnvironment.setCameraPosition(activeCamera.actor.x, activeCamera.actor.y, activeCamera.actor.z);

        // 4. Sun Data
        this.globalEnvironment.setSun(
          this.sunDirectionArray[0],
          this.sunDirectionArray[1],
          this.sunDirectionArray[2],
          120000.0
        );

        // 5. Atmosphere & Colors
        this.globalEnvironment.setAtmosphere(
          [1.0, 0.98, 0.95], 1.0,
          [0.15, 0.35, 0.75],
          [0.05, 0.05, 0.05]
        );

        // Batch Rendering Pass
        this.renderPBRBatch();
      }
    } catch (e) {
      Logger.warn("ENGINE", "Error en frame CSM: " + e);
    }
  };

  /**
   * Procesa todas las entidades visibles y organiza sus datos en el buffer de instancias.
   * Optimización: Agrupa por malla para minimizar cambios de estado en la GPU.
   */
  private renderPBRBatch(): void {
    const actors = this.activeWorld.getActors();

    // 1. Contar instancias por malla (Reutilizando Mapas para Zero-GC)
    for (const mesh of this.geometryRegistry.getMeshes()) {
      this.meshInstanceCounts.set(mesh.id, 0);
    }

    for (const actor of actors.values()) {
      if (actor.staticMesh) {
        const id = actor.staticMesh.meshId;
        this.meshInstanceCounts.set(id, (this.meshInstanceCounts.get(id) || 0) + 1);
      }
    }

    // 2. Definir offsets de inicio para el buffer flat
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

    // 3. Escribir datos de transformación y materiales (CPU -> BatchBuffer)
    if (totalInstances > 0) {
      this.updateInstanceBuffers();

      // 4. Envío único al RHI
      const activeView = this.batchBuffer.subarray(0, totalInstances * 40);
      this.rhi.renderFrame(this.drawCallPool, activeDrawCallCount, this.globalEnvironment, activeView);
    }
  }

  /**
   * Actualiza el buffer de instancia flat con las matrices y parámetros PBR.
   * Mantiene el estándar de 160 bytes (40 floats) por instancia.
   */
  private updateInstanceBuffers(): void {
    const rawTransforms = this.transformPool.getRawData();
    const actors = this.activeWorld.getActors();

    for (const actor of actors.values()) {
      if (actor.staticMesh) {
        const id = actor.staticMesh.meshId;
        const targetOffset = this.meshStartOffsets.get(id)!;

        // Matrix: Model (4x4)
        SMat4.fromRotationTranslationScale(
          this.batchBuffer,
          rawTransforms.subarray(actor.id * 16 + 3, actor.id * 16 + 7),
          rawTransforms.subarray(actor.id * 16, actor.id * 16 + 3),
          rawTransforms.subarray(actor.id * 16 + 7, actor.id * 16 + 10),
          targetOffset
        );

        // Matrix: Normal (Transpose Inverse 4x4)
        SMat4.invertTranspose4x4(this.batchBuffer, this.batchBuffer, targetOffset + 16, targetOffset);

        // PBR Data (BaseColor + Params)
        if (actor.material) {
          this.batchBuffer.set(actor.material.baseColor, targetOffset + 32);
          this.batchBuffer.set(actor.material.pbrParams, targetOffset + 36);
        } else {
          this.batchBuffer.set([1, 1, 1, 1, 0, 0.5, 0.5, 0], targetOffset + 32);
        }

        // Incrementar offset para la siguiente instancia de esta misma malla
        this.meshStartOffsets.set(id, targetOffset + 40);
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameid) cancelAnimationFrame(this.animationFrameid);
  }

  public getRHI(): SerionRHI { return this.rhi; }
}
