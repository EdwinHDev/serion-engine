import { SStaticMesh } from './SStaticMesh';
import { Logger } from '../utils/Logger';

/**
 * GeometryRegistry - Almacén central de mallas estáticas.
 * Genera y gestiona las primitivas base del motor bajo el estándar Z-Up y 32-byte layout.
 */
export class GeometryRegistry {
  private meshes: Map<string, SStaticMesh> = new Map();

  /**
   * Inicializa todas las primitivas estándar del motor.
   */
  public initialize(device: GPUDevice): void {
    Logger.info('GEOMETRY', "Inicializando Geometry Registry (Base Primitives)...");

    this.createCube(device);
    this.createPlane(device);
    this.createSphere(device);
    this.createCylinder(device);
    this.createCone(device);
    this.createCapsule(device);
  }

  private createCube(device: GPUDevice): void {
    const vertices = new Float32Array([
      // Pos(3), Normal(3), UV(2)
      -0.5, -0.5, 0.5, 0, 0, 1, 0, 1, 0.5, -0.5, 0.5, 0, 0, 1, 1, 1, 0.5, 0.5, 0.5, 0, 0, 1, 1, 0, -0.5, 0.5, 0.5, 0, 0, 1, 0, 0, // Z+
      -0.5, -0.5, -0.5, 0, 0, -1, 1, 1, -0.5, 0.5, -0.5, 0, 0, -1, 1, 0, 0.5, 0.5, -0.5, 0, 0, -1, 0, 0, 0.5, -0.5, -0.5, 0, 0, -1, 0, 1, // Z-
      0.5, -0.5, -0.5, 1, 0, 0, 0, 1, 0.5, 0.5, -0.5, 1, 0, 0, 1, 1, 0.5, 0.5, 0.5, 1, 0, 0, 1, 0, 0.5, -0.5, 0.5, 1, 0, 0, 0, 0, // X+
      -0.5, -0.5, -0.5, -1, 0, 0, 1, 1, -0.5, -0.5, 0.5, -1, 0, 0, 0, 1, -0.5, 0.5, 0.5, -1, 0, 0, 0, 0, -0.5, 0.5, -0.5, -1, 0, 0, 1, 0, // X-
      -0.5, 0.5, -0.5, 0, 1, 0, 0, 1, -0.5, 0.5, 0.5, 0, 1, 0, 1, 1, 0.5, 0.5, 0.5, 0, 1, 0, 1, 0, 0.5, 0.5, -0.5, 0, 1, 0, 0, 0, // Y+
      -0.5, -0.5, -0.5, 0, -1, 0, 1, 1, 0.5, -0.5, -0.5, 0, -1, 0, 0, 1, 0.5, -0.5, 0.5, 0, -1, 0, 0, 0, -0.5, -0.5, 0.5, 0, -1, 0, 1, 0, // Y-
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
    ]);

    this.registerMesh(device, 'Primitive_Cube', vertices, indices);
  }

  private createPlane(device: GPUDevice): void {
    const vertices = new Float32Array([
      -0.5, -0.5, 0, 0, 0, 1, 0, 1,
      0.5, -0.5, 0, 0, 0, 1, 1, 1,
      0.5, 0.5, 0, 0, 0, 1, 1, 0,
      -0.5, 0.5, 0, 0, 0, 1, 0, 0,
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    this.registerMesh(device, 'Primitive_Plane', vertices, indices);
  }

  private createSphere(device: GPUDevice): void {
    const segments = 32;
    const rings = 16;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= rings; i++) {
      const phi = (i * Math.PI) / rings;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let j = 0; j <= segments; j++) {
        const theta = (j * 2 * Math.PI) / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const nx = sinPhi * cosTheta;
        const ny = sinPhi * sinTheta;
        const nz = cosPhi;

        vertices.push(nx * 0.5, ny * 0.5, nz * 0.5, nx, ny, nz, j / segments, i / rings);
      }
    }

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const first = i * (segments + 1) + j;
        const second = first + segments + 1;
        indices.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }

    this.registerMesh(device, 'Primitive_Sphere', new Float32Array(vertices), new Uint16Array(indices));
  }

  private createCylinder(device: GPUDevice): void {
    const segments = 32;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Lateral Tube
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      const u = i / segments;

      // Bottom vertex
      vertices.push(nx * 0.5, ny * 0.5, -0.5, nx, ny, 0, u, 1);
      // Top vertex
      vertices.push(nx * 0.5, ny * 0.5, 0.5, nx, ny, 0, u, 0);
    }

    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }

    // Caps
    const baseIndex = vertices.length / 8;
    // Bottom Cap
    vertices.push(0, 0, -0.5, 0, 0, -1, 0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      vertices.push(Math.cos(theta) * 0.5, Math.sin(theta) * 0.5, -0.5, 0, 0, -1, (Math.cos(theta) + 1) * 0.5, (Math.sin(theta) + 1) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      indices.push(baseIndex, baseIndex + i + 1, baseIndex + i + 2);
    }

    const topIndex = vertices.length / 8;
    // Top Cap
    vertices.push(0, 0, 0.5, 0, 0, 1, 0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      vertices.push(Math.cos(theta) * 0.5, Math.sin(theta) * 0.5, 0.5, 0, 0, 1, (Math.cos(theta) + 1) * 0.5, (Math.sin(theta) + 1) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      indices.push(topIndex, topIndex + i + 2, topIndex + i + 1);
    }

    this.registerMesh(device, 'Primitive_Cylinder', new Float32Array(vertices), new Uint16Array(indices));
  }

  private createCone(device: GPUDevice): void {
    const segments = 32;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Base Cap
    const baseIndex = 0;
    vertices.push(0, 0, -0.5, 0, 0, -1, 0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      vertices.push(Math.cos(theta) * 0.5, Math.sin(theta) * 0.5, -0.5, 0, 0, -1, (Math.cos(theta) + 1) * 0.5, (Math.sin(theta) + 1) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      indices.push(baseIndex, baseIndex + i + 1, baseIndex + i + 2);
    }

    // Sides
    const sideStart = vertices.length / 8;
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      const nz = 0.5; // Aproximación de normal para cono 1x1
      const mag = Math.sqrt(nx * nx + ny * ny + nz * nz);

      vertices.push(nx * 0.5, ny * 0.5, -0.5, nx / mag, ny / mag, nz / mag, i / segments, 1);
      vertices.push(0, 0, 0.5, nx / mag, ny / mag, nz / mag, i / segments, 0);
    }
    for (let i = 0; i < segments; i++) {
      const b = sideStart + i * 2;
      indices.push(b, b + 2, b + 1);
    }

    this.registerMesh(device, 'Primitive_Cone', new Float32Array(vertices), new Uint16Array(indices));
  }

  private createCapsule(device: GPUDevice): void {
    const segments = 32;
    const rings = 8; // Per hemisphere
    const vertices: number[] = [];
    const indices: number[] = [];

    // Top Hemisphere (Z from 0.5 to 1.0)
    for (let i = 0; i <= rings; i++) {
      const phi = (i * Math.PI * 0.5) / rings;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      for (let j = 0; j <= segments; j++) {
        const theta = (j * 2 * Math.PI) / segments;
        const nx = sinPhi * Math.cos(theta);
        const ny = sinPhi * Math.sin(theta);
        const nz = cosPhi;
        vertices.push(nx * 0.5, ny * 0.5, 0.5 + nz * 0.5, nx, ny, nz, j / segments, (phi / Math.PI));
      }
    }

    // Cylinder Tube (Z from -0.5 to 0.5)
    const tubeStart = vertices.length / 8;
    for (let j = 0; j <= segments; j++) {
      const theta = (j * 2 * Math.PI) / segments;
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      vertices.push(nx * 0.5, ny * 0.5, 0.5, nx, ny, 0, j / segments, 0.5);
      vertices.push(nx * 0.5, ny * 0.5, -0.5, nx, ny, 0, j / segments, 0.7);
    }

    // Bottom Hemisphere (Z from -1.0 to -0.5)
    const bottomStart = vertices.length / 8;
    for (let i = 0; i <= rings; i++) {
      const phi = (Math.PI * 0.5) + (i * Math.PI * 0.5) / rings;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      for (let j = 0; j <= segments; j++) {
        const theta = (j * 2 * Math.PI) / segments;
        const nx = sinPhi * Math.cos(theta);
        const ny = sinPhi * Math.sin(theta);
        const nz = cosPhi;
        vertices.push(nx * 0.5, ny * 0.5, -0.5 + nz * 0.5, nx, ny, nz, j / segments, (phi / Math.PI));
      }
    }

    // Indices: Top Hemisphere
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const first = i * (segments + 1) + j;
        const second = first + segments + 1;
        indices.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    // Indices: Cylinder
    for (let j = 0; j < segments; j++) {
      const b = tubeStart + j * 2;
      indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    // Indices: Bottom Hemisphere
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const first = bottomStart + i * (segments + 1) + j;
        const second = first + segments + 1;
        indices.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }

    this.registerMesh(device, 'Primitive_Capsule', new Float32Array(vertices), new Uint16Array(indices));
  }

  private registerMesh(device: GPUDevice, id: string, vertices: Float32Array, indices: Uint16Array): void {
    const vb = device.createBuffer({ label: `${id}_VB`, size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, vertices.buffer as ArrayBuffer, vertices.byteOffset, vertices.byteLength);
    const ib = device.createBuffer({ label: `${id}_IB`, size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ib, 0, indices.buffer as ArrayBuffer, indices.byteOffset, indices.byteLength);
    this.meshes.set(id, new SStaticMesh(id, vb, ib, indices.length));
  }

  public getMeshIds(): string[] {
    return Array.from(this.meshes.keys());
  }

  public getMesh(id: string): SStaticMesh | undefined {
    return this.meshes.get(id);
  }
}
