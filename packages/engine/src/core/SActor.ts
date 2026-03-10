import { SStaticMeshComponent } from '../components/SStaticMeshComponent';
import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';
import { SMaterialComponent } from '../components/SMaterialComponent';
import { AABB } from '../math/AABB';
import { SWorld } from './SWorld';

/**
 * SActor - Proxy ligero para entidades en el mundo.
 * Corregido: Ahora depende de SWorld, no del Motor directamente.
 */
export class SActor {
  public staticMesh: SStaticMeshComponent | null = null;
  public material: SMaterialComponent | null = null;
  public directionalLight: SDirectionalLightComponent | null = null;
  public atmosphere: SAtmosphereComponent | null = null;
  public readonly worldAABB = new AABB();
  public name: string = 'Actor';
  public parentId: number | null = null;

  constructor(
    public readonly id: number,
    public readonly world: SWorld
  ) { }

  /**
   * Actualiza el AABB de mundo basado en un AABB local inyectado y la matriz de modelo.
   */
  public updateWorldAABB(localAABB: AABB, modelMatrix: Float32Array): void {
    this.worldAABB.copy(localAABB);
    this.worldAABB.transform(modelMatrix);
  }

  // --- ACCESSORS DE POSICIÓN ---

  public get x(): number { return this.world.engine.transformPool.getPositionX(this.id); }
  public set x(val: number) { this.world.engine.transformPool.setPosition(this.id, val, this.y, this.z); }

  public get y(): number { return this.world.engine.transformPool.getPositionY(this.id); }
  public set y(val: number) { this.world.engine.transformPool.setPosition(this.id, this.x, val, this.z); }

  public get z(): number { return this.world.engine.transformPool.getPositionZ(this.id); }
  public set z(val: number) { this.world.engine.transformPool.setPosition(this.id, this.x, this.y, val); }

  public setPosition(x: number, y: number, z: number): void {
    this.world.engine.transformPool.setPosition(this.id, x, y, z);
  }

  // --- ACCESSORS DE ROTACIÓN (CUATERNIONES) ---

  public get rotationX(): number { return this.world.engine.transformPool.getRotationX(this.id); }
  public set rotationX(val: number) { this.world.engine.transformPool.setRotation(this.id, val, this.rotationY, this.rotationZ, this.rotationW); }

  public get rotationY(): number { return this.world.engine.transformPool.getRotationY(this.id); }
  public set rotationY(val: number) { this.world.engine.transformPool.setRotation(this.id, this.rotationX, val, this.rotationZ, this.rotationW); }

  public get rotationZ(): number { return this.world.engine.transformPool.getRotationZ(this.id); }
  public set rotationZ(val: number) { this.world.engine.transformPool.setRotation(this.id, this.rotationX, this.rotationY, val, this.rotationW); }

  public get rotationW(): number { return this.world.engine.transformPool.getRotationW(this.id); }
  public set rotationW(val: number) { this.world.engine.transformPool.setRotation(this.id, this.rotationX, this.rotationY, this.rotationZ, val); }

  public setRotation(x: number, y: number, z: number, w: number): void {
    this.world.engine.transformPool.setRotation(this.id, x, y, z, w);
  }

  // --- ACCESSORS DE ESCALA ---

  public get scaleX(): number { return this.world.engine.transformPool.getScaleX(this.id); }
  public set scaleX(val: number) { this.world.engine.transformPool.setScale(this.id, val, this.scaleY, this.scaleZ); }

  public get scaleY(): number { return this.world.engine.transformPool.getScaleY(this.id); }
  public set scaleY(val: number) { this.world.engine.transformPool.setScale(this.id, this.scaleX, val, this.scaleZ); }

  public get scaleZ(): number { return this.world.engine.transformPool.getScaleZ(this.id); }
  public set scaleZ(val: number) { this.world.engine.transformPool.setScale(this.id, this.scaleX, this.scaleY, val); }

  public setScale(x: number, y: number, z: number): void {
    this.world.engine.transformPool.setScale(this.id, x, y, z);
  }

  /**
   * Vincula este actor a un padre.
   */
  public attachTo(parent: SActor): void {
    if (parent.id === this.id) return;
    this.parentId = parent.id;
    this.world.markSceneGraphDirty();
  }

  /**
   * Desvincula este actor de su padre actual.
   */
  public detach(): void {
    this.parentId = null;
    this.world.markSceneGraphDirty();
  }
}
