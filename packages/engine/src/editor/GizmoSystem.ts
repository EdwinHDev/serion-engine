import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';

/**
 * GizmoSystem - Maneja la lógica y geometría procedural del Gizmo de Traslación.
 * Capa 14.1: Geometría Procedural AAA (Cilindros, Conos y Planos).
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
    const data: number[] = [];

    const pushV = (x: number, y: number, z: number, c: number[]) => {
        data.push(x, y, z, c[0], c[1], c[2]);
    };

    // Parámetros de Escala Global del Gizmo
    const SCALE = 15.0;
    const stemRadius = 0.08 * SCALE;
    const stemLength = 5.0 * SCALE;
    const coneRadius = 0.35 * SCALE;
    const coneHeight = 1.5 * SCALE;
    const planeSize = 1.0 * SCALE;
    const planeOffset = 1.2 * SCALE;
    const centerSize = 0.3 * SCALE;

    const red = [1.0, 0.1, 0.1];
    const green = [0.1, 1.0, 0.1];
    const blue = [0.1, 0.3, 1.0];
    const white = [1.0, 1.0, 1.0];

    // 1. Helper: Cilindro Procedural (Tallos)
    const addCylinder = (axis: 'x'|'y'|'z', length: number, radius: number, color: number[]) => {
        const segments = 12;
        for(let i = 0; i < segments; i++) {
            const t1 = (i / segments) * Math.PI * 2;
            const t2 = ((i + 1) / segments) * Math.PI * 2;
            const c1 = Math.cos(t1) * radius; const s1 = Math.sin(t1) * radius;
            const c2 = Math.cos(t2) * radius; const s2 = Math.sin(t2) * radius;

            const getP = (d: number, u: number, v: number) => {
                if (axis === 'x') return [d, u, v];
                if (axis === 'y') return [u, d, v];
                return [u, v, d];
            };

            const p1 = getP(0, c1, s1); const p2 = getP(0, c2, s2);
            const p3 = getP(length, c1, s1); const p4 = getP(length, c2, s2);

            pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
            pushV(p2[0], p2[1], p2[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
        }
    };

    // 2. Helper: Cono Procedural (Puntas de Flecha)
    const addCone = (axis: 'x'|'y'|'z', offset: number, height: number, radius: number, color: number[]) => {
        const segments = 12;
        for(let i = 0; i < segments; i++) {
            const t1 = (i / segments) * Math.PI * 2;
            const t2 = ((i + 1) / segments) * Math.PI * 2;
            const c1 = Math.cos(t1) * radius; const s1 = Math.sin(t1) * radius;
            const c2 = Math.cos(t2) * radius; const s2 = Math.sin(t2) * radius;

            const getP = (d: number, u: number, v: number) => {
                if (axis === 'x') return [d, u, v];
                if (axis === 'y') return [u, d, v];
                return [u, v, d];
            };

            const p1 = getP(offset, c1, s1); const p2 = getP(offset, c2, s2);
            const tip = getP(offset + height, 0, 0); const center = getP(offset, 0, 0);

            // Manto del cono
            pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(tip[0], tip[1], tip[2], color);
            // Tapa inferior
            pushV(p2[0], p2[1], p2[2], color); pushV(p1[0], p1[1], p1[2], color); pushV(center[0], center[1], center[2], color);
        }
    };

    // 3. Helper: Plano 2D (Cuadrados de movimiento doble)
    const addPlane = (a1: 'x'|'y'|'z', a2: 'x'|'y'|'z', offset: number, size: number, color: number[]) => {
        const p1 = [0,0,0], p2 = [0,0,0], p3 = [0,0,0], p4 = [0,0,0];
        const set = (p: number[], a: string, v: number) => { if(a==='x') p[0]=v; else if(a==='y') p[1]=v; else p[2]=v; };
        
        set(p1, a1, offset); set(p1, a2, offset);
        set(p2, a1, offset+size); set(p2, a2, offset);
        set(p3, a1, offset+size); set(p3, a2, offset+size);
        set(p4, a1, offset); set(p4, a2, offset+size);

        // Doble cara para evitar backface culling
        pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
        pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p4[0], p4[1], p4[2], color);
        pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p2[0], p2[1], p2[2], color);
        pushV(p1[0], p1[1], p1[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
    };

    // 4. Helper: Cubo Central
    const addBox = (min: number, max: number, c: number[]) => {
        const v = [
            [min,min,max],[max,min,max],[max,max,max],[min,max,max],
            [min,min,min],[min,max,min],[max,max,min],[max,min,min],
            [min,max,min],[min,max,max],[max,max,max],[max,max,min],
            [min,min,min],[max,min,min],[max,min,max],[min,min,max],
            [max,min,min],[max,max,min],[max,max,max],[max,min,max],
            [min,min,min],[min,min,max],[min,max,max],[min,max,min]
        ];
        const idx = [0,1,2,0,2,3, 4,5,6,4,6,7, 8,9,10,8,10,11, 12,13,14,12,14,15, 16,17,18,16,18,19, 20,21,22,20,22,23];
        for (const i of idx) pushV(v[i][0], v[i][1], v[i][2], c);
    };

    // ==========================================
    // CONSTRUCCIÓN DEL GIZMO AAA
    // ==========================================
    
    // Eje X (Rojo)
    addCylinder('x', stemLength, stemRadius, red);
    addCone('x', stemLength, coneHeight, coneRadius, red);
    
    // Eje Y (Verde)
    addCylinder('y', stemLength, stemRadius, green);
    addCone('y', stemLength, coneHeight, coneRadius, green);
    
    // Eje Z (Azul)
    addCylinder('z', stemLength, stemRadius, blue);
    addCone('z', stemLength, coneHeight, coneRadius, blue);

    // Planos Duales
    addPlane('x', 'y', planeOffset, planeSize, blue); // Plano XY pintado de azul (Perpendicular a Z)
    addPlane('x', 'z', planeOffset, planeSize, green); // Plano XZ pintado de verde (Perpendicular a Y)
    addPlane('y', 'z', planeOffset, planeSize, red);   // Plano YZ pintado de rojo (Perpendicular a X)

    // Centro Blanco
    addBox(-centerSize, centerSize, white);

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
