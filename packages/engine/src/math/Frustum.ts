import { AABB } from './AABB';

/**
 * Frustum - Pirámide de visión de la cámara.
 * Capa 13.1: Matemática de Visibilidad.
 */
export class Frustum {
  /**
   * Planos del Frustum (Ax + By + Cz + D = 0).
   * 0: Left, 1: Right, 2: Bottom, 3: Top, 4: Near, 5: Far.
   */
  public planes = Array.from({ length: 6 }, () => new Float32Array(4));

  /**
   * Extrae los planos del frustum desde una matriz de proyección (o View-Projection).
   * Basado en la técnica de Gribb-Hartmann para WebGPU (NDC Z: 0 a 1).
   */
  public setFromProjectionMatrix(m: Float32Array): void {
    const p = this.planes;

    // Left
    p[0][0] = m[3] + m[0]; p[0][1] = m[7] + m[4]; p[0][2] = m[11] + m[8]; p[0][3] = m[15] + m[12];
    // Right
    p[1][0] = m[3] - m[0]; p[1][1] = m[7] - m[4]; p[1][2] = m[11] - m[8]; p[1][3] = m[15] - m[12];
    // Bottom
    p[2][0] = m[3] + m[1]; p[2][1] = m[7] + m[5]; p[2][2] = m[11] + m[9]; p[2][3] = m[15] + m[13];
    // Top
    p[3][0] = m[3] - m[1]; p[3][1] = m[7] - m[5]; p[3][2] = m[11] - m[9]; p[3][3] = m[15] - m[13];
    // Near (WebGPU NDC Z starts at 0)
    p[4][0] = m[2]; p[4][1] = m[6]; p[4][2] = m[10]; p[4][3] = m[14];
    // Far (WebGPU NDC Z ends at 1)
    p[5][0] = m[3] - m[2]; p[5][1] = m[7] - m[6]; p[5][2] = m[11] - m[10]; p[5][3] = m[15] - m[14];

    // Normalizar planos
    for (let i = 0; i < 6; i++) {
      const plane = p[i];
      const mag = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
      plane[0] /= mag;
      plane[1] /= mag;
      plane[2] /= mag;
      plane[3] /= mag;
    }
  }

  /**
   * Comprueba si un AABB interseca o está dentro del Frustum.
   * Optimización: "P-Vertex" (vértice positivo) para evitar evaluar los 8 puntos.
   */
  public intersectsAABB(aabb: AABB): boolean {
    const min = aabb.min;
    const max = aabb.max;

    for (let i = 0; i < 6; i++) {
      const p = this.planes[i];

      // Encontrar el vértice "más positivo" en la dirección de la normal del plano
      const px = p[0] > 0 ? max[0] : min[0];
      const py = p[1] > 0 ? max[1] : min[1];
      const pz = p[2] > 0 ? max[2] : min[2];

      // Si el punto más positivo está detrás del plano, el AABB está fuera
      if (p[0] * px + p[1] * py + p[2] * pz + p[3] < 0) {
        return false;
      }
    }

    return true;
  }
}
