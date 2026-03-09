import { AABB } from '../math/AABB';

/**
 * SStaticMesh.ts - Contenedor de mallas estáticas.
 * Almacena los buffers de GPU y metadatos necesarios para el dibujado indexado.
 */
export class SStaticMesh {
  public readonly localAABB = new AABB();

  constructor(
    public readonly id: string,
    public readonly vertexBuffer: GPUBuffer,
    public readonly indexBuffer: GPUBuffer,
    public readonly indexCount: number,
    vertices?: Float32Array // Opcional para cálculo de AABB
  ) {
    if (vertices) {
      this.localAABB.setFromPoints(vertices, 32, 0);
    }
  }

  public destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
  }
}
