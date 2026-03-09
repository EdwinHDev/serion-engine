import { SMat4 } from '../math/SMath';

/**
 * TransformPool - Gestión de memoria contigua para transformaciones (DOD).
 * Almacena posición, rotación, escala, Matriz de Modelo (Global) y Matriz Normal.
 * Alineación: 48 floats (192 bytes) por entidad. (64-byte blocks x 3)
 */
export class TransformPool {
  private readonly data: Float32Array;
  private readonly stride: number = 48;

  // Variables estáticas para evitar GC en el hot-path
  private static readonly _tempLocal = new Float32Array(16);
  private static readonly _tempPos = new Float32Array(3);
  private static readonly _tempRot = new Float32Array(4);
  private static readonly _tempSca = new Float32Array(3);

  /**
   * @param maxEntities Cantidad máxima de actores soportados en el pool.
   */
  constructor(public readonly maxEntities: number) {
    this.data = new Float32Array(maxEntities * this.stride);

    // Inicialización por defecto: Posición(0,0,0), Rotación(0,0,0,1), Escala(1,1,1)
    for (let i = 0; i < maxEntities; i++) {
      this.setScale(i, 1, 1, 1);
      this.setRotation(i, 0, 0, 0, 1);

      // Inicializar matrices como identidad
      const offset = i * this.stride;
      SMat4.identity(this.data.subarray(offset + 16, offset + 32));
      SMat4.identity(this.data.subarray(offset + 32, offset + 48));
    }
  }

  /**
   * Actualiza la matriz global del actor y su matriz normal.
   * Lógica Zero-GC.
   */
  public updateActorGlobalMatrix(actorId: number, parentGlobalMatrix?: Float32Array): void {
    const offset = actorId * this.stride;

    // 1. Obtener PRS del pool
    TransformPool._tempPos[0] = this.data[offset];
    TransformPool._tempPos[1] = this.data[offset + 1];
    TransformPool._tempPos[2] = this.data[offset + 2];

    TransformPool._tempRot[0] = this.data[offset + 3];
    TransformPool._tempRot[1] = this.data[offset + 4];
    TransformPool._tempRot[2] = this.data[offset + 5];
    TransformPool._tempRot[3] = this.data[offset + 6];

    TransformPool._tempSca[0] = this.data[offset + 7];
    TransformPool._tempSca[1] = this.data[offset + 8];
    TransformPool._tempSca[2] = this.data[offset + 9];

    // 2. Calcular Matriz Local (PRS -> Mat4)
    SMat4.fromRotationTranslationScale(
      TransformPool._tempLocal,
      TransformPool._tempRot,
      TransformPool._tempPos,
      TransformPool._tempSca
    );

    const modelMatrixOffset = offset + 16;
    const modelMatrixView = this.data.subarray(modelMatrixOffset, modelMatrixOffset + 16);

    // 3. Calcular Matriz Global (Global = ParentGlobal * Local)
    if (parentGlobalMatrix) {
      SMat4.multiply(modelMatrixView, parentGlobalMatrix, TransformPool._tempLocal);
    } else {
      modelMatrixView.set(TransformPool._tempLocal);
    }

    // 4. Calcular Matriz Normal (Inverse Transpose de la Global)
    const normalMatrixOffset = offset + 32;
    const normalMatrixView = this.data.subarray(normalMatrixOffset, normalMatrixOffset + 16);
    SMat4.invertTranspose4x4(normalMatrixView, modelMatrixView);
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
   * Obtiene la Matriz de Modelo (Global) de una entidad.
   */
  public getModelMatrix(entityId: number): Float32Array {
    const offset = entityId * this.stride + 16;
    return this.data.subarray(offset, offset + 16);
  }

  /**
   * Obtiene la Matriz Normal (Inverse Transpose) de una entidad.
   */
  public getNormalMatrix(entityId: number): Float32Array {
    const offset = entityId * this.stride + 32;
    return this.data.subarray(offset, offset + 16);
  }

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
