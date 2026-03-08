import { SerionRHI } from './rhi/SerionRHI';
import { Logger } from './utils/Logger';
import { TransformPool } from './memory/TransformPool';
import { SWorld } from './core/SWorld';
import { SMat4 } from './math/SMath';
import { InputManager } from './core/InputManager';

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

  // [CAMERA STATE]: Propiedades para la Fly Camera
  private cameraPosition = { x: 0, y: -20, z: 10 };

  // [MATH]: Buffers Zero GC
  private viewMat = new Float32Array(16);
  private projMat = new Float32Array(16);
  private viewProjMat = new Float32Array(16);

  // [GEOMETRY]: Cubo 3D Estándar (36 vértices)
  private static readonly CUBE_GEOMETRY = new Float32Array([
    // Frontal (Z+)
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Trasera (Z-)
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    // Superior (Y+)
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    // Inferior (Y-)
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Derecha (X+)
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Izquierda (X-)
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  ]);

  constructor() {
    this.rhi = new SerionRHI();
    const maxEntities = 10000;
    this.transformPool = new TransformPool(maxEntities);
    this.activeWorld = new SWorld(this, maxEntities);

    Logger.info('ENGINE', "Motor inicializado.");
  }

  public async start(canvas: HTMLCanvasElement): Promise<void> {
    try {
      if (this.isRunning) return;
      await this.rhi.initialize(canvas, this.transformPool.maxEntities, SerionEngine.CUBE_GEOMETRY);

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
      Logger.info('ENGINE', "Bucle de simulación iniciado.");
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

    // --- INPUT & FLY CAMERA ---
    const moveSpeed = 20.0 * deltaTime;

    // Movimiento básico (WASD)
    if (InputManager.isKeyDown('KeyW')) this.cameraPosition.y += moveSpeed;
    if (InputManager.isKeyDown('KeyS')) this.cameraPosition.y -= moveSpeed;
    if (InputManager.isKeyDown('KeyD')) this.cameraPosition.x += moveSpeed;
    if (InputManager.isKeyDown('KeyA')) this.cameraPosition.x -= moveSpeed;

    // Elevación (Espacio / Shift)
    if (InputManager.isKeyDown('Space')) this.cameraPosition.z += moveSpeed;
    if (InputManager.isKeyDown('ShiftLeft')) this.cameraPosition.z -= moveSpeed;

    // --- SIMULACIÓN & RENDER ---
    this.activeWorld.tick(deltaTime);

    const aspect = window.innerWidth / window.innerHeight;
    SMat4.perspective(this.projMat, 45 * Math.PI / 180, aspect, 0.1, 2000.0);

    // Matriz de Vista Dinámica
    SMat4.lookAt(this.viewMat,
      [this.cameraPosition.x, this.cameraPosition.y, this.cameraPosition.z],
      [this.cameraPosition.x, this.cameraPosition.y + 1, this.cameraPosition.z - 0.5], // Mirando hacia adelante/abajo
      [0, 0, 1] // Z-Up
    );

    SMat4.multiply(this.viewProjMat, this.projMat, this.viewMat);

    const activeCount = this.activeWorld.getEntityManager().getActiveCount();
    if (activeCount > 0) {
      this.rhi.renderFrame(this.transformPool.getRawData(), activeCount, this.viewProjMat);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public getRHI(): SerionRHI { return this.rhi; }
}
