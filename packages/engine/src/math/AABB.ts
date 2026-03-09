/**
 * AABB - Axis-Aligned Bounding Box.
 * Capa 13.1: Matemática de Visibilidad.
 */
export class AABB {
  public min = new Float32Array([Infinity, Infinity, Infinity]);
  public max = new Float32Array([-Infinity, -Infinity, -Infinity]);

  /**
   * Calcula el AABB a partir de una lista de puntos.
   * @param positions Buffer de posiciones (vértices).
   * @param strideBytes Salto entre vértices en bytes (frecuentemente 32 o 40).
   * @param offsetBytes Desplazamiento inicial en bytes.
   */
  public setFromPoints(positions: Float32Array, strideBytes: number, offsetBytes: number): void {
    this.min[0] = this.min[1] = this.min[2] = Infinity;
    this.max[0] = this.max[1] = this.max[2] = -Infinity;

    const strideFloats = strideBytes / 4;
    const offsetFloats = offsetBytes / 4;

    for (let i = offsetFloats; i < positions.length; i += strideFloats) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      if (x < this.min[0]) this.min[0] = x;
      if (y < this.min[1]) this.min[1] = y;
      if (z < this.min[2]) this.min[2] = z;

      if (x > this.max[0]) this.max[0] = x;
      if (y > this.max[1]) this.max[1] = y;
      if (z > this.max[2]) this.max[2] = z;
    }
  }

  /**
   * Copia los valores de otro AABB.
   */
  public copy(source: AABB): void {
    this.min[0] = source.min[0];
    this.min[1] = source.min[1];
    this.min[2] = source.min[2];
    this.max[0] = source.max[0];
    this.max[1] = source.max[1];
    this.max[2] = source.max[2];
  }

  /**
   * Transforma este AABB por una matriz 4x4.
   * Recalcula el nuevo AABB alineado a los ejes.
   */
  public transform(m: Float32Array): void {
    const minX = this.min[0], minY = this.min[1], minZ = this.min[2];
    const maxX = this.max[0], maxY = this.max[1], maxZ = this.max[2];

    this.min[0] = this.min[1] = this.min[2] = Infinity;
    this.max[0] = this.max[1] = this.max[2] = -Infinity;

    // Los 8 vértices del cubo
    this.transformPoint(minX, minY, minZ, m);
    this.transformPoint(minX, minY, maxZ, m);
    this.transformPoint(minX, maxY, minZ, m);
    this.transformPoint(minX, maxY, maxZ, m);
    this.transformPoint(maxX, minY, minZ, m);
    this.transformPoint(maxX, minY, maxZ, m);
    this.transformPoint(maxX, maxY, minZ, m);
    this.transformPoint(maxX, maxY, maxZ, m);
  }

  private transformPoint(x: number, y: number, z: number, m: Float32Array): void {
    const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
    const tz = m[2] * x + m[6] * y + m[10] * z + m[14];

    if (tx < this.min[0]) this.min[0] = tx;
    if (ty < this.min[1]) this.min[1] = ty;
    if (tz < this.min[2]) this.min[2] = tz;

    if (tx > this.max[0]) this.max[0] = tx;
    if (ty > this.max[1]) this.max[1] = ty;
    if (tz > this.max[2]) this.max[2] = tz;
  }
}
