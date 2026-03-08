/**
 * Interfaz mínima para evitar dependencias circulares con SerionEngine.
 */
interface IEngineProxy {
  transformPool: {
    getPositionX(id: number): number;
    getPositionY(id: number): number;
    getPositionZ(id: number): number;
    setPosition(id: number, x: number, y: number, z: number): void;
    getScaleX(id: number): number;
    getScaleY(id: number): number;
    getScaleZ(id: number): number;
    setScale(id: number, x: number, y: number, z: number): void;
  };
}

/**
 * SActor - Modelo de Actores Proxy (Envoltura Ligera).
 * Delega toda la gestión de datos pesados al TransformPool (DOD).
 */
export class SActor {
  /**
   * @param id Identificador único de la entidad en el motor.
   * @param engine Referencia al motor para acceder a los pools de memoria.
   */
  constructor(
    public readonly id: number,
    private readonly engine: IEngineProxy
  ) { }

  // --- ACCESSORS DE POSICIÓN ---

  public get x(): number { return this.engine.transformPool.getPositionX(this.id); }
  public set x(val: number) { this.engine.transformPool.setPosition(this.id, val, this.y, this.z); }

  public get y(): number { return this.engine.transformPool.getPositionY(this.id); }
  public set y(val: number) { this.engine.transformPool.setPosition(this.id, this.x, val, this.z); }

  public get z(): number { return this.engine.transformPool.getPositionZ(this.id); }
  public set z(val: number) { this.engine.transformPool.setPosition(this.id, this.x, this.y, val); }

  /**
   * Setea la posición completa en una sola llamada (más eficiente).
   */
  public setPosition(x: number, y: number, z: number): void {
    this.engine.transformPool.setPosition(this.id, x, y, z);
  }

  // --- ACCESSORS DE ESCALA ---

  public get scaleX(): number { return this.engine.transformPool.getScaleX(this.id); }
  public set scaleX(val: number) { this.engine.transformPool.setScale(this.id, val, this.scaleY, this.scaleZ); }

  public get scaleY(): number { return this.engine.transformPool.getScaleY(this.id); }
  public set scaleY(val: number) { this.engine.transformPool.setScale(this.id, this.scaleX, val, this.scaleZ); }

  public get scaleZ(): number { return this.engine.transformPool.getScaleZ(this.id); }
  public set scaleZ(val: number) { this.engine.transformPool.setScale(this.id, this.scaleX, this.scaleY, val); }

  /**
   * Setea la escala completa en una sola llamada.
   */
  public setScale(x: number, y: number, z: number): void {
    this.engine.transformPool.setScale(this.id, x, y, z);
  }
}
