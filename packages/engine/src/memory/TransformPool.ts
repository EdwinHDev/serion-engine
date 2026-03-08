/**
 * TransformPool - Gestión de memoria contigua para transformaciones (DOD).
 * Almacena posición, rotación y escala de miles de entidades en un solo Float32Array.
 * Alineación: 16 floats (64 bytes) por entidad.
 */
export class TransformPool {
  private readonly data: Float32Array;
  private readonly stride: number = 16;

  /**
   * @param maxEntities Cantidad máxima de actores soportados en el pool.
   */
  constructor(public readonly maxEntities: number) {
    this.data = new Float32Array(maxEntities * this.stride);

    // Inicialización por defecto: Posición(0,0,0), Rotación(0,0,0,1), Escala(1,1,1)
    for (let i = 0; i < maxEntities; i++) {
      this.setScale(i, 1, 1, 1);
      this.setRotation(i, 0, 0, 0, 1);
    }
  }

  // --- SETTERS (High Performance, No GC) ---

  public setPosition(entityId: number, x: number, y: number, z: number): void {
    const offset = entityId * this.stride;
    this.data[offset] = x;
    this.data[offset + 1] = y;
    this.data[offset + 2] = z;
  }

  public setRotation(entityId: number, x: number, y: number, z: number, w: number): void {
    const offset = entityId * this.stride;
    this.data[offset + 3] = x;
    this.data[offset + 4] = y;
    this.data[offset + 5] = z;
    this.data[offset + 6] = w;
  }

  public setScale(entityId: number, x: number, y: number, z: number): void {
    const offset = entityId * this.stride;
    this.data[offset + 7] = x;
    this.data[offset + 8] = y;
    this.data[offset + 9] = z;
  }

  // --- GETTERS (High Performance, Return Primitive Values) ---

  public getPositionX(entityId: number): number { return this.data[entityId * this.stride]; }
  public getPositionY(entityId: number): number { return this.data[entityId * this.stride + 1]; }
  public getPositionZ(entityId: number): number { return this.data[entityId * this.stride + 2]; }

  public getRotationX(entityId: number): number { return this.data[entityId * this.stride + 3]; }
  public getRotationY(entityId: number): number { return this.data[entityId * this.stride + 4]; }
  public getRotationZ(entityId: number): number { return this.data[entityId * this.stride + 5]; }
  public getRotationW(entityId: number): number { return this.data[entityId * this.stride + 6]; }

  public getScaleX(entityId: number): number { return this.data[entityId * this.stride + 7]; }
  public getScaleY(entityId: number): number { return this.data[entityId * this.stride + 8]; }
  public getScaleZ(entityId: number): number { return this.data[entityId * this.stride + 9]; }

  /**
   * Obtiene el Float32Array completo para subida masiva a GPU.
   */
  public getRawData(): Float32Array {
    return this.data;
  }

  /**
   * Obtiene el tamaño de memoria reservada en bytes.
   */
  public getByteSize(): number {
    return this.data.byteLength;
  }
}
