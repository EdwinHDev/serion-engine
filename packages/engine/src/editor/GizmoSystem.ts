import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';

/**
 * GizmoSystem - Maneja la lógica y geometría del Gizmo de Traslación.
 * Capa 14.1: Renderizado Constante y Superposición.
 */
export class GizmoSystem {
  private vertexBuffer: GPUBuffer | null = null;
  private matrixBuffer: GPUBuffer | null = null;
  public matrixBindGroup: GPUBindGroup | null = null;

  private gizmoMatrix = new Float32Array(16);
  private vertexCount = 0;

  constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
    this.createGeometry(device);
    this.createBuffers(device, layout);
  }

  private createGeometry(device: GPUDevice): void {
    // 3 Ejes, cada uno es un "box" de 12 triángulos (36 vértices)
    // Formato: X, Y, Z, R, G, B
    const data: number[] = [];

    // Función auxiliar para añadir un cubo (box)
    const addBox = (min: number[], max: number[], color: number[]) => {
        const [x0, y0, z0] = min;
        const [x1, y1, z1] = max;
        const [r, g, b] = color;

        const verts = [
            // front
            [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
            // back
            [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0],
            // top
            [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0],
            // bottom
            [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
            // right
            [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1],
            // left
            [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]
        ];

        const indices = [
            0, 1, 2, 0, 2, 3,    // front
            4, 5, 6, 4, 6, 7,    // back
            8, 9, 10, 8, 10, 11, // top
            12, 13, 14, 12, 14, 15, // bottom
            16, 17, 18, 16, 18, 19, // right
            20, 21, 22, 20, 22, 23  // left
        ];

        for (const i of indices) {
            data.push(...verts[i], r, g, b);
        }
    };

    // Ejes (100u = 1m si 1u=1cm)
    addBox([0, -0.5, -0.5], [100, 0.5, 0.5], [1, 0, 0]); // Eje X (Rojo)
    addBox([-0.5, 0, -0.5], [0.5, 100, 0.5], [0, 1, 0]); // Eje Y (Verde)
    addBox([-0.5, -0.5, 0], [0.5, 0.5, 100], [0, 0, 1]); // Eje Z (Azul)

    this.vertexCount = data.length / 6;
    const vertexArray = new Float32Array(data);

    this.vertexBuffer = device.createBuffer({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexArray);
    this.vertexBuffer.unmap();
  }

  private createBuffers(device: GPUDevice, layout: GPUBindGroupLayout): void {
    this.matrixBuffer = device.createBuffer({
      size: 64, // mat4x4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.matrixBindGroup = device.createBindGroup({
      layout: layout,
      entries: [{ binding: 0, resource: { buffer: this.matrixBuffer } }]
    });
  }

  public update(queue: GPUQueue, selectedActor: SActor | null): void {
    if (!selectedActor || !this.matrixBuffer) return;

    // Solo traslación, rotación identidad (World Space)
    SMat4.identity(this.gizmoMatrix);
    this.gizmoMatrix[12] = selectedActor.x;
    this.gizmoMatrix[13] = selectedActor.y;
    this.gizmoMatrix[14] = selectedActor.z;

    queue.writeBuffer(this.matrixBuffer, 0, this.gizmoMatrix);
  }

  public draw(pass: GPURenderPassEncoder): void {
    if (!this.vertexBuffer || !this.matrixBindGroup) return;

    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setBindGroup(1, this.matrixBindGroup);
    pass.draw(this.vertexCount);
  }
}
