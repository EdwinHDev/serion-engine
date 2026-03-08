/**
 * SStaticMesh.ts - Contenedor de mallas estáticas.
 * Almacena los buffers de GPU y metadatos necesarios para el dibujado indexado.
 */
export class SStaticMesh {
  constructor(
    public readonly id: string,
    public readonly vertexBuffer: GPUBuffer,
    public readonly indexBuffer: GPUBuffer,
    public readonly indexCount: number
  ) { }

  public destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
  }
}
