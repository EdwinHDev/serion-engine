import { SStaticMesh } from './SStaticMesh';
import { Logger } from '../utils/Logger';

/**
 * GeometryRegistry - Almacén central de mallas estáticas.
 * Genera y gestiona las primitivas base del motor.
 */
export class GeometryRegistry {
  private meshes: Map<string, SStaticMesh> = new Map();

  /**
   * Inicializa las primitivas estándar.
   */
  public initialize(device: GPUDevice): void {
    Logger.info('GEOMETRY', "Inicializando Geometry Registry y primitivas...");

    this.createCube(device);
    // Futuro: createSphere, createPlane, etc.
  }

  private createCube(device: GPUDevice): void {
    // 24 Vértices (4 por cara para normales duras)
    // Layout: Pos(3), Normal(3), UV(2) = 8 floats per vertex (32 bytes)
    const vertices = new Float32Array([
      // Frontal (Z+) - Normal [0, 0, 1]
      -0.5, -0.5, 0.5, 0, 0, 1, 0, 1,
      0.5, -0.5, 0.5, 0, 0, 1, 1, 1,
      0.5, 0.5, 0.5, 0, 0, 1, 1, 0,
      -0.5, 0.5, 0.5, 0, 0, 1, 0, 0,

      // Trasera (Z-) - Normal [0, 0, -1]
      -0.5, -0.5, -0.5, 0, 0, -1, 1, 1,
      -0.5, 0.5, -0.5, 0, 0, -1, 1, 0,
      0.5, 0.5, -0.5, 0, 0, -1, 0, 0,
      0.5, -0.5, -0.5, 0, 0, -1, 0, 1,

      // Superior (Z+) en convención local, pero vamos a seguir Z-Up global: 
      // Superior (Up) es Z+ en este motor.
      // Cara Superior (Z+) - Ya está arriba. 
      // Cara "Top" real en Z-Up es la que mira a Z+.
      // Vamos a definir las caras según los ejes:

      // Derecha (X+) - Normal [1, 0, 0]
      0.5, -0.5, -0.5, 1, 0, 0, 0, 1,
      0.5, 0.5, -0.5, 1, 0, 0, 1, 1,
      0.5, 0.5, 0.5, 1, 0, 0, 1, 0,
      0.5, -0.5, 0.5, 1, 0, 0, 0, 0,

      // Izquierda (X-) - Normal [-1, 0, 0]
      -0.5, -0.5, -0.5, -1, 0, 0, 1, 1,
      -0.5, -0.5, 0.5, -1, 0, 0, 0, 1,
      -0.5, 0.5, 0.5, -1, 0, 0, 0, 0,
      -0.5, 0.5, -0.5, -1, 0, 0, 1, 0,

      // "Forward" (Y+) - Normal [0, 1, 0]
      -0.5, 0.5, -0.5, 0, 1, 0, 0, 1,
      -0.5, 0.5, 0.5, 0, 1, 0, 1, 1,
      0.5, 0.5, 0.5, 0, 1, 0, 1, 0,
      0.5, 0.5, -0.5, 0, 1, 0, 0, 0,

      // "Backward" (Y-) - Normal [0, -1, 0]
      -0.5, -0.5, -0.5, 0, -1, 0, 1, 1,
      0.5, -0.5, -0.5, 0, -1, 0, 0, 1,
      0.5, -0.5, 0.5, 0, -1, 0, 0, 0,
      -0.5, -0.5, 0.5, 0, -1, 0, 1, 0,
    ]);

    // 36 Índices (6 caras * 2 triángulos * 3 vértices)
    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,    // Front
      4, 5, 6, 4, 6, 7,    // Back
      8, 9, 10, 8, 10, 11,  // Right
      12, 13, 14, 12, 14, 15, // Left
      16, 17, 18, 16, 18, 19, // Forward
      20, 21, 22, 20, 22, 23  // Backward
    ]);

    const vertexBuffer = device.createBuffer({
      label: 'Primitive_Cube_VB',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const indexBuffer = device.createBuffer({
      label: 'Primitive_Cube_IB',
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(indexBuffer, 0, indices);

    this.meshes.set('Primitive_Cube', new SStaticMesh(
      'Primitive_Cube',
      vertexBuffer,
      indexBuffer,
      indices.length
    ));
  }

  public getMesh(id: string): SStaticMesh | undefined {
    return this.meshes.get(id);
  }
}
