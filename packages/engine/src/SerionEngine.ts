import { SerionRHI, SDrawCall } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { CameraManager } from './camera/CameraManager';
import { SCamera } from './camera/SCamera';
import { FreeCameraController } from './camera/FreeCameraController';
import { GeometryRegistry } from './geometry/GeometryRegistry';
import { SMat4 } from './math/SMath';
import { SGlobalEnvironmentData } from './core/SGlobalEnvironmentData';
import { CascadedShadowManager } from './lighting/CascadedShadowManager';
import { AtmosphereSystem } from './lighting/AtmosphereSystem';
import { SceneBuilder } from './scene/SceneBuilder';
import { Frustum } from './math/Frustum';
import { SActor } from './core/SActor';


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

  // --- TELEMETRY ---
  private lastTelemetryTime = 0;
  private telemetryFrames = 0;

  private freeCameraController: FreeCameraController | null = null;
  private readonly ORIGIN_SHIFT_THRESHOLD = 200000.0; // 2 km

  // --- CULLING PROPERTIES (Zero-GC) ---
  private mainCameraFrustum = new Frustum();
  private visibleActors: SActor[] = new Array(10000);
  private visibleActorCount = 0;
  private tempModelMatrix = new Float32Array(16);

  // Stride 40 floats (160 bytes)
  private batchBuffer = new Float32Array(10000 * 40);

  // Fallback defaults (evitan basura en el loop)
  private defaultSunDirection = new Float32Array([0.5, 0.5, -1.0]);
  private defaultZeroColor = new Float32Array([0, 0, 0]);

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

    // Normalizar default
    const d = this.defaultSunDirection;
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

      // --- ESCENA SHOWCASE PBR (Centralizada en SceneBuilder) ---
      SceneBuilder.buildShowcase(this.activeWorld);

      this.isRunning = true;
      this.lastTime = performance.now();
      this.animationFrameid = requestAnimationFrame(this.loop);

      Logger.info('ENGINE', "Capa 12.6: Gestor CSM Dinámico Activo.");
    } catch (error) {
      Logger.error('ENGINE', "Fallo crítico:", error as any);
      throw error;
    }
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
        // --- FLOATING ORIGIN SHIFT (Mundos Masivos) ---
        const distSq = (activeCamera.actor.x * activeCamera.actor.x) + (activeCamera.actor.y * activeCamera.actor.y);
        if (distSq > (this.ORIGIN_SHIFT_THRESHOLD * this.ORIGIN_SHIFT_THRESHOLD)) {
          this.activeWorld.shiftOrigin(activeCamera.actor.x, activeCamera.actor.y, 0);
        }

        activeCamera.aspectRatio = this.rhi.getAspectRatio();

        // 1. Matriz Cámara Jugador
        this.globalEnvironment.setViewProjectionMatrix(activeCamera.getViewProjectionMatrix());

        // 2. ACTUALIZACIÓN DINÁMICA DE ENTORNO (Capa 13.3)
        this.updateGlobalEnvironment(activeCamera);

        // --- VISIBILITY PHASE (Capa 13.2) ---


        // --- VISIBILITY PHASE (Capa 13.2) ---
        this.performCulling();

        // Batch Rendering Pass
        this.renderPBRBatch();

        // --- TELEMETRY PHASE (Capa 13.6) ---
        this.telemetryFrames++;
        if (currentTime - this.lastTelemetryTime >= 500) {
          const fps = Math.round((this.telemetryFrames * 1000) / (currentTime - this.lastTelemetryTime));
          const ms = (currentTime - this.lastTelemetryTime) / this.telemetryFrames;

          window.dispatchEvent(new CustomEvent('serion:telemetry', {
            detail: {
              fps: fps,
              ms: ms.toFixed(1),
              visibleActors: this.visibleActorCount,
              totalActors: this.activeWorld.getActors().size
            }
          }));

          this.lastTelemetryTime = currentTime;
          this.telemetryFrames = 0;
        }
      }
    } catch (e) {
      Logger.warn("ENGINE", "Error en frame CSM: " + e);
    }
  };

  /**
   * Extrae proactivamente los datos de iluminación y atmósfera de la escena.
   * Centraliza la actualización del GlobalEnvironment y CSM Manager.
   */
  private updateGlobalEnvironment(camera: SCamera): void {
    const actors = this.activeWorld.getActors();
    let sunComp: import('./components/SDirectionalLightComponent').SDirectionalLightComponent | null = null;
    let atmoComp: import('./components/SAtmosphereComponent').SAtmosphereComponent | null = null;

    // 1. Extraer los componentes clave (Zero-GC)
    for (const actor of actors.values()) {
      if (!sunComp && actor.directionalLight) sunComp = actor.directionalLight;
      if (!atmoComp && actor.atmosphere) atmoComp = actor.atmosphere;
      if (sunComp && atmoComp) break;
    }

    if (sunComp && atmoComp) {
      // 2. EL CEREBRO FÍSICO: Calcular Transmitancia en CPU
      AtmosphereSystem.updateTransmittance(sunComp, atmoComp);

      // 3. Enviar datos físicos del Sol al GPU
      this.globalEnvironment.setSun(
        sunComp.direction[0], sunComp.direction[1], sunComp.direction[2],
        sunComp.intensity
      );
      // Aseguramos que el color tintado del sol llega al buffer (Float offsets 60, 61, 62)
      this.globalEnvironment.buffer[60] = sunComp.color[0];
      this.globalEnvironment.buffer[61] = sunComp.color[1];
      this.globalEnvironment.buffer[62] = sunComp.color[2];

      // 4. Enviar los colores hemisféricos generados para iluminar los modelos PBR
      this.globalEnvironment.setAtmosphere(
        atmoComp._calculatedSkyColor,
        atmoComp.ambientIntensity,
        atmoComp._calculatedSkyColor,
        atmoComp._calculatedGroundColor
      );

      // 5. Inyectar coeficientes de Rayleigh y Mie para el SkyShader Procedural
      if (typeof this.globalEnvironment.setAtmospherePhysics === 'function') {
        this.globalEnvironment.setAtmospherePhysics(
          atmoComp.rayleighScattering,
          atmoComp.mieScattering,
          atmoComp.planetRadius,
          atmoComp.atmosphereRadius
        );
      }

      this.csmManager.update(camera, sunComp.direction, this.globalEnvironment);
    } else {
      // Fallbacks si la escena está vacía
      this.globalEnvironment.setSun(this.defaultSunDirection[0], this.defaultSunDirection[1], this.defaultSunDirection[2], 0.0);
      this.globalEnvironment.setAtmosphere(this.defaultZeroColor, 0, this.defaultZeroColor, this.defaultZeroColor);
      this.csmManager.update(camera, this.defaultSunDirection, this.globalEnvironment);
    }

    // Posición de cámara independiente
    this.globalEnvironment.setCameraPosition(camera.actor.x, camera.actor.y, camera.actor.z);
  }

  /**
   * Fase de descarte geométrico (Frustum Culling).
   * Determina qué actores son visibles para la cámara principal.
   */
  private performCulling(): void {
    this.visibleActorCount = 0;

    // 1. Extraer planos del frustum desde la matriz VP (NDC WebGPU 0-1)
    const vpMatrix = this.globalEnvironment.buffer.subarray(0, 16);
    this.mainCameraFrustum.setFromProjectionMatrix(vpMatrix);

    const rawTransforms = this.transformPool.getRawData();
    const actors = this.activeWorld.getActors();

    // 2. Evaluar visibilidad (AABB interseca Frustum)
    for (const actor of actors.values()) {
      if (!actor.staticMesh) continue;

      const mesh = this.geometryRegistry.getMesh(actor.staticMesh.meshId);
      if (!mesh) continue;

      // Calcular matriz de modelo JIT para el AABB
      SMat4.fromRotationTranslationScale(
        this.tempModelMatrix,
        rawTransforms.subarray(actor.id * 16 + 3, actor.id * 16 + 7),
        rawTransforms.subarray(actor.id * 16, actor.id * 16 + 3),
        rawTransforms.subarray(actor.id * 16 + 7, actor.id * 16 + 10),
        0
      );

      // Actualizar World AABB
      actor.updateWorldAABB(mesh.localAABB, this.tempModelMatrix);

      // Prueba de intersección
      if (this.mainCameraFrustum.intersectsAABB(actor.worldAABB)) {
        if (this.visibleActorCount < 10000) {
          this.visibleActors[this.visibleActorCount++] = actor;
        }
      }
    }
  }

  /**
   * Procesa todas las entidades visibles y organiza sus datos en el buffer de instancias.
   * Optimización: Agrupa por malla para minimizar cambios de estado en la GPU.
   */
  private renderPBRBatch(): void {
    // 1. Contar instancias por malla (Solo sobre los visibles)
    for (const mesh of this.geometryRegistry.getMeshes()) {
      this.meshInstanceCounts.set(mesh.id, 0);
    }

    for (let i = 0; i < this.visibleActorCount; i++) {
      const actor = this.visibleActors[i];
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

    for (let i = 0; i < this.visibleActorCount; i++) {
      const actor = this.visibleActors[i];
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
