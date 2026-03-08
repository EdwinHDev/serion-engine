import { SStaticMesh } from './SStaticMesh';
import { Logger } from '../utils/Logger';

/**
 * GeometryRegistry - Almacén central de mallas estáticas.
 * Genera y gestiona las primitivas base del motor bajo el estándar Z-Up y 32-byte layout.
 * Optimizaciones Capa 10.5: Winding Order Fix (CCW) y Smooth Normals.
 */
export class GeometryRegistry {
  private meshes: Map<string, SStaticMesh> = new Map();

  public initialize(device: GPUDevice): void {
    Logger.info('GEOMETRY', "Corrigiendo Normales y Winding de Primitivas...");

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
    const segments = 64;
    const rings = 32;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= rings; i++) {
      const phi = (i * Math.PI) / rings;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      for (let j = 0; j <= segments; j++) {
        const theta = (j * 2 * Math.PI) / segments;
        const nx = sinP * Math.cos(theta);
        const ny = sinP * Math.sin(theta);
        const nz = cosP;
        vertices.push(nx * 0.5, ny * 0.5, nz * 0.5, nx, ny, nz, j / segments, i / rings);
      }
    }

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const first = i * (segments + 1) + j;
        const second = (i + 1) * (segments + 1) + j;
        // Winding CCW from outside: TopLeft -> BottomLeft -> BottomRight and TopLeft -> BottomRight -> TopRight
        indices.push(first, second, second + 1, first, second + 1, first + 1);
      }
    }
    this.registerMesh(device, 'Primitive_Sphere', new Float32Array(vertices), new Uint16Array(indices));
  }

  private createCylinder(device: GPUDevice): void {
    const segments = 64;
    const vertices: number[] = [];
    const indices: number[] = [];

    // --- TUBE ---
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      vertices.push(nx * 0.5, ny * 0.5, -0.5, nx, ny, 0, i / segments, 1); // Bottom
      vertices.push(nx * 0.5, ny * 0.5, 0.5, nx, ny, 0, i / segments, 0);  // Top
    }
    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      // CCW: Bottom-Left -> Bottom-Right -> Top-Right ...
      indices.push(b, b + 2, b + 3, b, b + 3, b + 1);
    }

    // --- BOTTOM CAP (Z = -0.5) ---
    const bottomBase = vertices.length / 8;
    vertices.push(0, 0, -0.5, 0, 0, -1, 0.5, 0.5); // Center
    for (let i = 0; i <= segments; i++) {
      const t = (i * 2 * Math.PI) / segments;
      vertices.push(Math.cos(t) * 0.5, Math.sin(t) * 0.5, -0.5, 0, 0, -1, (Math.cos(t) + 1) * 0.5, (Math.sin(t) + 1) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      // Looking from -Z: Center -> Prev -> Next is CW in XY, which is CCW from outside
      indices.push(bottomBase, bottomBase + i + 2, bottomBase + i + 1);
    }

    // --- TOP CAP (Z = 0.5) ---
    const topBase = vertices.length / 8;
    vertices.push(0, 0, 0.5, 0, 0, 1, 0.5, 0.5); // Center
    for (let i = 0; i <= segments; i++) {
      const t = (i * 2 * Math.PI) / segments;
      vertices.push(Math.cos(t) * 0.5, Math.sin(t) * 0.5, 0.5, 0, 0, 1, (Math.cos(t) + 1) * 0.5, (Math.sin(t) + 1) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      // Looking from +Z: Center -> Next -> Prev is CCW from outside
      indices.push(topBase, topBase + i + 1, topBase + i + 2);
    }

    this.registerMesh(device, 'Primitive_Cylinder', new Float32Array(vertices), new Uint16Array(indices));
  }

  private createCone(device: GPUDevice): void {
    const segments = 64;
    const vertices: number[] = [];
    const indices: number[] = [];

    // --- SIDE (Smooth) ---
    // Normal calculation: slope of a cone with r=0.5, h=1.0 is 0.5. Normal is (nx, ny, 0.5) normalized.
    const sideStart = 0;
    for (let i = 0; i <= segments; i++) {
      const theta = (i * 2 * Math.PI) / segments;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const mag = Math.sqrt(cosT * cosT + sinT * sinT + 0.25);
      const nx = cosT / mag;
      const ny = sinT / mag;
      const nz = 0.5 / mag;

      vertices.push(cosT * 0.5, sinT * 0.5, -0.5, nx, ny, nz, i / segments, 1); // Base ring
      vertices.push(0, 0, 0.5, nx, ny, nz, i / segments, 0);               // Tip
    }
    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      indices.push(b, b + 2, b + 1); // CCW from outside
    }

    // --- BOTTOM CAP (Z = -0.5) ---
    const bottomBase = vertices.length / 8;
    vertices.push(0, 0, -0.5, 0, 0, -1, 0.5, 0.5); // Center
    for (let i = 0; i <= segments; i++) {
      const t = (i * 2 * Math.PI) / segments;
      vertices.push(Math.cos(t) * 0.5, Math.sin(t) * 0.5, -0.5, 0, 0, -1, (Math.cos(t) + 1) * 0.5, (Math.sin(t) + 1) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      indices.push(bottomBase, bottomBase + i + 2, bottomBase + i + 1);
    }

    this.registerMesh(device, 'Primitive_Cone', new Float32Array(vertices), new Uint16Array(indices));
  }

  private createCapsule(device: GPUDevice): void {
    const segments = 64;
    const rings = 16;
    const vertices: number[] = [];
    const indices: number[] = [];
    const radius = 0.25;
    const bodyHeight = 0.5;

    // Top Hemisphere
    for (let i = 0; i <= rings; i++) {
      const phi = (i * Math.PI * 0.5) / rings;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      for (let j = 0; j <= segments; j++) {
        const theta = (j * 2 * Math.PI) / segments;
        const nx = sinP * Math.cos(theta);
        const ny = sinP * Math.sin(theta);
        const nz = cosP;
        vertices.push(nx * radius, ny * radius, (bodyHeight * 0.5) + nz * radius, nx, ny, nz, j / segments, i / (rings * 2));
      }
    }
    // Bottom Hemisphere
    const bottomStart = vertices.length / 8;
    for (let i = 0; i <= rings; i++) {
      const phi = (Math.PI * 0.5) + (i * Math.PI * 0.5) / rings;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      for (let j = 0; j <= segments; j++) {
        const theta = (j * 2 * Math.PI) / segments;
        const nx = sinP * Math.cos(theta);
        const ny = sinP * Math.sin(theta);
        const nz = cosP;
        vertices.push(nx * radius, ny * radius, (-bodyHeight * 0.5) + nz * radius, nx, ny, nz, j / segments, (rings + i) / (rings * 2));
      }
    }

    // Indices Top
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const first = i * (segments + 1) + j;
        const second = (i + 1) * (segments + 1) + j;
        indices.push(first, second, second + 1, first, second + 1, first + 1);
      }
    }
    // Middle Connection
    const r1 = rings * (segments + 1);
    const r2 = bottomStart;
    for (let j = 0; j < segments; j++) {
      indices.push(r1 + j, r2 + j, r2 + j + 1, r1 + j, r2 + j + 1, r1 + j + 1);
    }
    // Indices Bottom
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const first = bottomStart + i * (segments + 1) + j;
        const second = bottomStart + (i + 1) * (segments + 1) + j;
        indices.push(first, second, second + 1, first, second + 1, first + 1);
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

  public getMeshes(): IterableIterator<SStaticMesh> { return this.meshes.values(); }
  public getMesh(id: string): SStaticMesh | undefined { return this.meshes.get(id); }
}
