import { SStaticMeshComponent } from '../components/SStaticMeshComponent';
import { AABB } from '../math/AABB';

/**
 * Interfaz mínima para evitar dependencias circulares con SerionEngine.
 */
interface IEngineProxy {
  transformPool: {
    getPositionX(id: number): number;
    getPositionY(id: number): number;
    getPositionZ(id: number): number;
    setPosition(id: number, x: number, y: number, z: number): void;

    getRotationX(id: number): number;
    getRotationY(id: number): number;
    getRotationZ(id: number): number;
    getRotationW(id: number): number;
    setRotation(id: number, x: number, y: number, z: number, w: number): void;

    getScaleX(id: number): number;
    getScaleY(id: number): number;
    getScaleZ(id: number): number;
    setScale(id: number, x: number, y: number, z: number): void;
  };
}

/**
 * SActor - Proxy ligero para entidades en el mundo.
 */
import { SMaterialComponent } from '../components/SMaterialComponent';

export class SActor {
  public staticMesh: SStaticMeshComponent | null = null;
  public material: SMaterialComponent | null = null;
  public readonly worldAABB = new AABB();

  constructor(
    public readonly id: number,
    private readonly engine: IEngineProxy
  ) { }

  /**
   * Actualiza el AABB de mundo basado en la malla actual y la matriz de modelo.
   * @param modelMatrix Matriz de transformación 4x4.
   */
  public updateWorldAABB(modelMatrix: Float32Array): void {
    if (this.staticMesh && this.staticMesh.mesh) {
      this.worldAABB.copy(this.staticMesh.mesh.localAABB);
      this.worldAABB.transform(modelMatrix);
    }
  }

  // --- ACCESSORS DE POSICIÓN ---

  public get x(): number { return this.engine.transformPool.getPositionX(this.id); }
  public set x(val: number) { this.engine.transformPool.setPosition(this.id, val, this.y, this.z); }

  public get y(): number { return this.engine.transformPool.getPositionY(this.id); }
  public set y(val: number) { this.engine.transformPool.setPosition(this.id, this.x, val, this.z); }

  public get z(): number { return this.engine.transformPool.getPositionZ(this.id); }
  public set z(val: number) { this.engine.transformPool.setPosition(this.id, this.x, this.y, val); }

  public setPosition(x: number, y: number, z: number): void {
    this.engine.transformPool.setPosition(this.id, x, y, z);
  }

  // --- ACCESSORS DE ROTACIÓN (CUATERNIONES) ---

  public get rotationX(): number { return this.engine.transformPool.getRotationX(this.id); }
  public set rotationX(val: number) { this.engine.transformPool.setRotation(this.id, val, this.rotationY, this.rotationZ, this.rotationW); }

  public get rotationY(): number { return this.engine.transformPool.getRotationY(this.id); }
  public set rotationY(val: number) { this.engine.transformPool.setRotation(this.id, this.rotationX, val, this.rotationZ, this.rotationW); }

  public get rotationZ(): number { return this.engine.transformPool.getRotationZ(this.id); }
  public set rotationZ(val: number) { this.engine.transformPool.setRotation(this.id, this.rotationX, this.rotationY, val, this.rotationW); }

  public get rotationW(): number { return this.engine.transformPool.getRotationW(this.id); }
  public set rotationW(val: number) { this.engine.transformPool.setRotation(this.id, this.rotationX, this.rotationY, this.rotationZ, val); }

  public setRotation(x: number, y: number, z: number, w: number): void {
    this.engine.transformPool.setRotation(this.id, x, y, z, w);
  }

  // --- ACCESSORS DE ESCALA ---

  public get scaleX(): number { return this.engine.transformPool.getScaleX(this.id); }
  public set scaleX(val: number) { this.engine.transformPool.setScale(this.id, val, this.scaleY, this.scaleZ); }

  public get scaleY(): number { return this.engine.transformPool.getScaleY(this.id); }
  public set scaleY(val: number) { this.engine.transformPool.setScale(this.id, this.scaleX, val, this.scaleZ); }

  public get scaleZ(): number { return this.engine.transformPool.getScaleZ(this.id); }
  public set scaleZ(val: number) { this.engine.transformPool.setScale(this.id, this.scaleX, this.scaleY, val); }

  public setScale(x: number, y: number, z: number): void {
    this.engine.transformPool.setScale(this.id, x, y, z);
  }
}
