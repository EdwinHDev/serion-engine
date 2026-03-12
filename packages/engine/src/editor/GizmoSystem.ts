import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';
import { Ray } from '../math/Ray';
import { SCamera } from '../camera/SCamera';

export type GizmoPart = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'center';

export class GizmoSystem {
  private vertexBuffer: GPUBuffer | null = null;
  private matrixBuffer: GPUBuffer | null = null;
  public matrixBindGroup: GPUBindGroup | null = null;

  private gizmoMatrix = new Float32Array(16);
  private vertexCount = 0;
  
  public hoveredPart: GizmoPart | null = null;

  private isDragging = false;
  private dragPlaneNormal = [0,0,0];
  private dragPlanePoint = [0,0,0];
  private dragOffset = [0,0,0];
  private dragStartActorPos = [0,0,0];
  private dragAxis = [0,0,0];

  // Cajas de colisión locales (Alineadas a la geometría procedural base)
  private readonly hitBoxes: Record<GizmoPart, { min: number[], max: number[] }> = {
    'center': { min: [-0.4, -0.4, -0.4], max: [0.4, 0.4, 0.4] },
    'x': { min: [0.4, -0.2, -0.2], max: [6.5, 0.2, 0.2] },
    'y': { min: [-0.2, 0.4, -0.2], max: [0.2, 6.5, 0.2] },
    'z': { min: [-0.2, -0.2, 0.4], max: [0.2, 0.2, 6.5] },
    'xy': { min: [1.0, 1.0, -0.1], max: [2.5, 2.5, 0.1] },
    'xz': { min: [1.0, -0.1, 1.0], max: [2.5, 0.1, 2.5] },
    'yz': { min: [-0.1, 1.0, 1.0], max: [0.1, 2.5, 2.5] }
  };

  constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
    this.createBuffers(device, layout);
    this.rebuildGeometry(device);
  }

  private rebuildGeometry(device: GPUDevice, queue?: GPUQueue): void {
    const data: number[] = [];
    const pushV = (x: number, y: number, z: number, c: number[]) => { data.push(x, y, z, c[0], c[1], c[2]); };

    const SCALE = 1.0;
    const stemRadius = 0.12 * SCALE; const stemLength = 5.0 * SCALE;
    const coneRadius = 0.45 * SCALE; const coneHeight = 1.5 * SCALE;
    const planeSize = 1.2 * SCALE; const planeOffset = 1.5 * SCALE;
    const centerSize = 0.3 * SCALE;

    const red = [1.0, 0.05, 0.05]; const green = [0.05, 1.0, 0.05]; const blue = [0.1, 0.25, 1.0];
    const white = [1.0, 1.0, 1.0]; const yellow = [1.0, 1.0, 0.0]; // Color de Hover

    const getColor = (part: GizmoPart, defaultColor: number[]) => this.hoveredPart === part ? yellow : defaultColor;

    const addCylinder = (axis: 'x'|'y'|'z', length: number, radius: number, color: number[]) => {
      const segments = 12;
      for(let i = 0; i < segments; i++) {
        const t1 = (i / segments) * Math.PI * 2; const t2 = ((i + 1) / segments) * Math.PI * 2;
        const c1 = Math.cos(t1) * radius; const s1 = Math.sin(t1) * radius;
        const c2 = Math.cos(t2) * radius; const s2 = Math.sin(t2) * radius;
        const getP = (d: number, u: number, v: number) => axis === 'x' ? [d, u, v] : axis === 'y' ? [u, d, v] : [u, v, d];
        const p1 = getP(0, c1, s1); const p2 = getP(0, c2, s2);
        const p3 = getP(length, c1, s1); const p4 = getP(length, c2, s2);
        pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
        pushV(p2[0], p2[1], p2[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
      }
    };

    const addCone = (axis: 'x'|'y'|'z', offset: number, height: number, radius: number, color: number[]) => {
      const segments = 12;
      for(let i = 0; i < segments; i++) {
        const t1 = (i / segments) * Math.PI * 2; const t2 = ((i + 1) / segments) * Math.PI * 2;
        const c1 = Math.cos(t1) * radius; const s1 = Math.sin(t1) * radius;
        const c2 = Math.cos(t2) * radius; const s2 = Math.sin(t2) * radius;
        const getP = (d: number, u: number, v: number) => axis === 'x' ? [d, u, v] : axis === 'y' ? [u, d, v] : [u, v, d];
        const p1 = getP(offset, c1, s1); const p2 = getP(offset, c2, s2);
        const tip = getP(offset + height, 0, 0); const center = getP(offset, 0, 0);
        pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(tip[0], tip[1], tip[2], color);
        pushV(p2[0], p2[1], p2[2], color); pushV(p1[0], p1[1], p1[2], color); pushV(center[0], center[1], center[2], color);
      }
    };

    const addPlane = (a1: 'x'|'y'|'z', a2: 'x'|'y'|'z', offset: number, size: number, color: number[]) => {
      const p1 = [0,0,0], p2 = [0,0,0], p3 = [0,0,0], p4 = [0,0,0];
      const set = (p: number[], a: string, v: number) => { if(a==='x') p[0]=v; else if(a==='y') p[1]=v; else p[2]=v; };
      set(p1, a1, offset); set(p1, a2, offset); set(p2, a1, offset+size); set(p2, a2, offset);
      set(p3, a1, offset+size); set(p3, a2, offset+size); set(p4, a1, offset); set(p4, a2, offset+size);
      pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
      pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p4[0], p4[1], p4[2], color);
      pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p2[0], p2[1], p2[2], color);
      pushV(p1[0], p1[1], p1[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
    };

    const addBox = (min: number, max: number, c: number[]) => {
      const v = [[min,min,max],[max,min,max],[max,max,max],[min,max,max],[min,min,min],[min,max,min],[max,max,min],[max,min,min],[min,max,min],[min,max,max],[max,max,max],[max,max,min],[min,min,min],[max,min,min],[max,min,max],[min,min,max],[max,min,min],[max,max,min],[max,max,max],[max,min,max],[min,min,min],[min,min,max],[min,max,max],[min,max,min]];
      const idx = [0,1,2,0,2,3, 4,5,6,4,6,7, 8,9,10,8,10,11, 12,13,14,12,14,15, 16,17,18,16,18,19, 20,21,22,20,22,23];
      for (const i of idx) pushV(v[i][0], v[i][1], v[i][2], c);
    };

    addCylinder('x', stemLength, stemRadius, getColor('x', red)); addCone('x', stemLength, coneHeight, coneRadius, getColor('x', red));
    addCylinder('y', stemLength, stemRadius, getColor('y', green)); addCone('y', stemLength, coneHeight, coneRadius, getColor('y', green));
    addCylinder('z', stemLength, stemRadius, getColor('z', blue)); addCone('z', stemLength, coneHeight, coneRadius, getColor('z', blue));
    addPlane('x', 'y', planeOffset, planeSize, getColor('xy', blue));
    addPlane('x', 'z', planeOffset, planeSize, getColor('xz', green));
    addPlane('y', 'z', planeOffset, planeSize, getColor('yz', red));
    addBox(-centerSize, centerSize, getColor('center', white));

    this.vertexCount = data.length / 6;
    const vertexArray = new Float32Array(data);

    if (!this.vertexBuffer) {
      this.vertexBuffer = device.createBuffer({ size: 100000, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }
    if (queue) queue.writeBuffer(this.vertexBuffer, 0, vertexArray);
    else device.queue.writeBuffer(this.vertexBuffer, 0, vertexArray);
  }

  private createBuffers(device: GPUDevice, layout: GPUBindGroupLayout): void {
    this.matrixBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.matrixBindGroup = device.createBindGroup({ layout: layout, entries: [{ binding: 0, resource: { buffer: this.matrixBuffer } }] });
  }

  public updateHover(device: GPUDevice, queue: GPUQueue, newHover: GizmoPart | null): void {
    if (this.isDragging || this.hoveredPart === newHover) return;
    this.hoveredPart = newHover;
    this.rebuildGeometry(device, queue);
  }

  private rayBoxIntersect(ro: number[], rd: number[], min: number[], max: number[]): number | null {
    let tmin = -Infinity; let tmax = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(rd[i]) < 0.000001) {
        if (ro[i] < min[i] || ro[i] > max[i]) return null;
      } else {
        const ood = 1.0 / rd[i];
        let t1 = (min[i] - ro[i]) * ood; let t2 = (max[i] - ro[i]) * ood;
        if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin >= 0 ? tmin : null;
  }

  public beginDrag(ray: Ray, camera: SCamera, actor: SActor): void {
    if (!this.hoveredPart) return;
    this.isDragging = true;
    this.dragStartActorPos = [actor.x, actor.y, actor.z];
    this.dragPlanePoint = [actor.x, actor.y, actor.z];

    const viewDir = [camera.actor.x - actor.x, camera.actor.y - actor.y, camera.actor.z - actor.z];
    const vl = Math.sqrt(viewDir[0]**2 + viewDir[1]**2 + viewDir[2]**2);
    if (vl > 0) { viewDir[0]/=vl; viewDir[1]/=vl; viewDir[2]/=vl; }

    this.dragAxis = [0,0,0];

    // Construir el Plano Virtual Perpendicular a la vista pero alineado al Eje
    if (this.hoveredPart === 'x') { this.dragAxis = [1,0,0]; this.dragPlaneNormal = [0, viewDir[1], viewDir[2]]; }
    else if (this.hoveredPart === 'y') { this.dragAxis = [0,1,0]; this.dragPlaneNormal = [viewDir[0], 0, viewDir[2]]; }
    else if (this.hoveredPart === 'z') { this.dragAxis = [0,0,1]; this.dragPlaneNormal = [viewDir[0], viewDir[1], 0]; }
    else if (this.hoveredPart === 'xy') { this.dragAxis = [1,1,0]; this.dragPlaneNormal = [0,0,1]; }
    else if (this.hoveredPart === 'xz') { this.dragAxis = [1,0,1]; this.dragPlaneNormal = [0,1,0]; }
    else if (this.hoveredPart === 'yz') { this.dragAxis = [0,1,1]; this.dragPlaneNormal = [1,0,0]; }
    else if (this.hoveredPart === 'center') { this.dragAxis = [1,1,1]; this.dragPlaneNormal = [viewDir[0], viewDir[1], viewDir[2]]; }

    const nl = Math.sqrt(this.dragPlaneNormal[0]**2 + this.dragPlaneNormal[1]**2 + this.dragPlaneNormal[2]**2);
    if (nl > 0) { this.dragPlaneNormal[0]/=nl; this.dragPlaneNormal[1]/=nl; this.dragPlaneNormal[2]/=nl; }

    const t = ray.intersectPlane(this.dragPlaneNormal, this.dragPlanePoint);
    if (t !== null) {
      this.dragOffset = [
        (ray.origin[0] + ray.direction[0] * t) - actor.x,
        (ray.origin[1] + ray.direction[1] * t) - actor.y,
        (ray.origin[2] + ray.direction[2] * t) - actor.z
      ];
    }
  }

  public updateDrag(ray: Ray, actor: SActor): void {
    if (!this.isDragging) return;
    const t = ray.intersectPlane(this.dragPlaneNormal, this.dragPlanePoint);
    if (t !== null) {
      const hitX = ray.origin[0] + ray.direction[0] * t;
      const hitY = ray.origin[1] + ray.direction[1] * t;
      const hitZ = ray.origin[2] + ray.direction[2] * t;

      let newX = hitX - this.dragOffset[0]; let newY = hitY - this.dragOffset[1]; let newZ = hitZ - this.dragOffset[2];

      // Restricción matemática estricta a los ejes permitidos
      if (this.dragAxis[0] === 0) newX = this.dragStartActorPos[0];
      if (this.dragAxis[1] === 0) newY = this.dragStartActorPos[1];
      if (this.dragAxis[2] === 0) newZ = this.dragStartActorPos[2];

      actor.setPosition(newX, newY, newZ);
    }
  }

  public endDrag(): void { this.isDragging = false; }

  public hitTest(ray: Ray, camera: SCamera, actor: SActor): GizmoPart | null {
    const dx = actor.x - camera.actor.x;
    const dy = actor.y - camera.actor.y;
    const dz = actor.z - camera.actor.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // MAGIA AAA: Exactamente la misma escala que el Shader (Calibración del Arquitecto)
    const scale = Math.max(dist * 0.025, 0.15);

    // Transformar rayo al espacio local del Gizmo
    const localOrigin = [
      (ray.origin[0] - actor.x) / scale,
      (ray.origin[1] - actor.y) / scale,
      (ray.origin[2] - actor.z) / scale
    ];
    const localDir = [ray.direction[0], ray.direction[1], ray.direction[2]];

    let closestT = Infinity;
    let hitPart: GizmoPart | null = null;

    for (const [part, box] of Object.entries(this.hitBoxes)) {
      const t = this.rayBoxIntersect(localOrigin, localDir, box.min, box.max);
      if (t !== null && t < closestT) {
        closestT = t;
        hitPart = part as GizmoPart;
      }
    }
    return hitPart;
  }

  public update(queue: GPUQueue, selectedActor: SActor | null): void {
    if (!selectedActor || !this.matrixBuffer) return;
    SMat4.identity(this.gizmoMatrix);
    this.gizmoMatrix[12] = selectedActor.x; this.gizmoMatrix[13] = selectedActor.y; this.gizmoMatrix[14] = selectedActor.z;
    queue.writeBuffer(this.matrixBuffer, 0, this.gizmoMatrix);
  }

  public draw(pass: GPURenderPassEncoder): void {
    if (!this.vertexBuffer || !this.matrixBindGroup) return;
    pass.setVertexBuffer(0, this.vertexBuffer); pass.setBindGroup(1, this.matrixBindGroup); pass.draw(this.vertexCount);
  }
}
