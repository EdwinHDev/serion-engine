import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';
import { Ray } from '../math/Ray';
import { SCamera } from '../camera/SCamera';

export type GizmoPart = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'center' | 'rx' | 'ry' | 'rz';
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

export class GizmoSystem {
  private device: GPUDevice;
  private vertexBuffer: GPUBuffer | null = null;
  private matrixBuffer: GPUBuffer | null = null;
  public matrixBindGroup: GPUBindGroup | null = null;

  private gizmoMatrix = new Float32Array(20);
  private vertexCount = 0;

  public mode: TransformMode = 'translate';
  public hoveredPart: GizmoPart | null = null;
  public isDragging = false;

  public dragStartAngle = 0;
  public dragLastAngle = 0;
  public accumulatedAngle = 0;
  public currentDeltaAngle = 0;
  public dragStartActorRot = [0, 0, 0, 1]; // Ahora almacena X, Y, Z, W

  public currentSnapEnabled = false;
  public currentSnapValue = 0;

  public dragPlaneNormal = [0, 0, 0]; public dragPlanePoint = [0, 0, 0];
  public dragOffset = [0, 0, 0]; public dragStartActorPos = [0, 0, 0]; public dragAxis = [0, 0, 0];

  private readonly hitBoxes: Record<string, { min: number[], max: number[] }> = {
    'center': { min: [-0.4, -0.4, -0.4], max: [0.4, 0.4, 0.4] },
    'x': { min: [0.4, -0.2, -0.2], max: [6.5, 0.2, 0.2] },
    'y': { min: [-0.2, 0.4, -0.2], max: [0.2, 6.5, 0.2] },
    'z': { min: [-0.2, -0.2, 0.4], max: [0.2, 0.2, 6.5] },
    'xy': { min: [1.0, 1.0, -0.1], max: [2.5, 2.5, 0.1] },
    'xz': { min: [1.0, -0.1, 1.0], max: [2.5, 0.1, 2.5] },
    'yz': { min: [-0.1, 1.0, 1.0], max: [0.1, 2.5, 2.5] }
  };

  private readonly ROT_RADIUS = 5.0; // Aumentado de 3.5 a 5.0 (Mayor diámetro)
  private readonly ROT_WIDTH = 0.5;  // Aumentado de 0.35 a 0.5 (Cinta más visible)

  constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
    this.device = device;
    this.createBuffers(device, layout);
    this.rebuildGeometry();
  }

  public setMode(_device: GPUDevice, newMode: TransformMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.hoveredPart = null;
    this.rebuildGeometry();
  }

  public getRotationReadout(): string {
    const deg = this.currentDeltaAngle * (180.0 / Math.PI);
    const absDeg = Math.abs(deg);
    const turns = Math.floor(absDeg / 360.0);

    // Aplicar módulo para que el número de grados nunca pase de 359.99
    const displayDeg = absDeg % 360.0;

    // Preservar el signo negativo si estamos girando en reversa y no está en 0 exacto
    const sign = (deg < 0 && displayDeg > 0.001) ? '-' : '';

    let text = `${sign}${displayDeg.toFixed(2)}°`;

    // Corrección de idioma y gramática (singular/plural)
    if (turns > 0) {
      text += turns === 1 ? ` (${turns} turn)` : ` (${turns} turns)`;
    }

    return text;
  }

  private rebuildGeometry(): void {
    const data: number[] = [];
    const pushV = (x: number, y: number, z: number, c: number[]) => { data.push(x, y, z, c[0], c[1], c[2]); };

    const red = [1.0, 0.05, 0.05]; const green = [0.05, 1.0, 0.05]; const blue = [0.1, 0.25, 1.0];
    const white = [1.0, 1.0, 1.0]; const yellow = [1.0, 1.0, 0.0];

    const getColor = (part: GizmoPart, defaultColor: number[]) => this.hoveredPart === part ? yellow : defaultColor;

    if (this.mode === 'translate') {
      const SCALE = 1.0;
      const stemRadius = 0.12 * SCALE; const stemLength = 5.0 * SCALE;
      const coneRadius = 0.45 * SCALE; const coneHeight = 1.5 * SCALE;
      const planeSize = 1.2 * SCALE; const planeOffset = 1.5 * SCALE;
      const centerSize = 0.3 * SCALE;

      const addCylinder = (axis: 'x' | 'y' | 'z', length: number, radius: number, color: number[]) => {
        const segments = 12;
        for (let i = 0; i < segments; i++) {
          const t1 = (i / segments) * Math.PI * 2; const t2 = ((i + 1) / segments) * Math.PI * 2;
          const c1 = Math.cos(t1) * radius; const s1 = Math.sin(t1) * radius;
          const c2 = Math.cos(t2) * radius; const s2 = Math.sin(t2) * radius;
          const getP = (d: number, u: number, v: number) => axis === 'x' ? [d, u, v] : axis === 'y' ? [u, d, v] : [u, v, d];
          const p1 = getP(0, c1, s1); const p2 = getP(0, c2, s2); const p3 = getP(length, c1, s1); const p4 = getP(length, c2, s2);
          pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
          pushV(p2[0], p2[1], p2[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
        }
      };

      const addCone = (axis: 'x' | 'y' | 'z', offset: number, height: number, radius: number, color: number[]) => {
        const segments = 12;
        for (let i = 0; i < segments; i++) {
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

      const addPlane = (a1: 'x' | 'y' | 'z', a2: 'x' | 'y' | 'z', offset: number, size: number, color: number[]) => {
        const p1 = [0, 0, 0], p2 = [0, 0, 0], p3 = [0, 0, 0], p4 = [0, 0, 0];
        const set = (p: number[], a: string, v: number) => { if (a === 'x') p[0] = v; else if (a === 'y') p[1] = v; else p[2] = v; };
        set(p1, a1, offset); set(p1, a2, offset); set(p2, a1, offset + size); set(p2, a2, offset);
        set(p3, a1, offset + size); set(p3, a2, offset + size); set(p4, a1, offset); set(p4, a2, offset + size);
        pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
        pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p4[0], p4[1], p4[2], color);
        pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p2[0], p2[1], p2[2], color);
        pushV(p1[0], p1[1], p1[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
      };

      const addBox = (min: number, max: number, c: number[]) => {
        const v = [[min, min, max], [max, min, max], [max, max, max], [min, max, max], [min, min, min], [min, max, min], [max, max, min], [max, min, min], [min, max, min], [min, max, max], [max, max, max], [max, max, min], [min, min, min], [max, min, min], [max, min, max], [min, min, max], [max, min, min], [max, max, min], [max, max, max], [max, min, max], [min, min, min], [min, min, max], [min, max, max], [min, max, min]];
        const idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23];
        for (const i of idx) pushV(v[i][0], v[i][1], v[i][2], c);
      };

      addCylinder('x', stemLength, stemRadius, getColor('x', red)); addCone('x', stemLength, coneHeight, coneRadius, getColor('x', red));
      addCylinder('y', stemLength, stemRadius, getColor('y', green)); addCone('y', stemLength, coneHeight, coneRadius, getColor('y', green));
      addCylinder('z', stemLength, stemRadius, getColor('z', blue)); addCone('z', stemLength, coneHeight, coneRadius, getColor('z', blue));
      addPlane('x', 'y', planeOffset, planeSize, getColor('xy', blue)); addPlane('x', 'z', planeOffset, planeSize, getColor('xz', green)); addPlane('y', 'z', planeOffset, planeSize, getColor('yz', red));
      addBox(-centerSize, centerSize, getColor('center', white));

    } else if (this.mode === 'rotate') {

      // Función para crear Cintas Planas (Ribbons)
      const addFlatArc = (axis: 'x' | 'y' | 'z', radius: number, width: number, startAngle: number, endAngle: number, color: number[]) => {
        const segments = Math.max(12, Math.floor(48 * ((endAngle - startAngle) / (Math.PI * 2))));
        const r1 = radius - width / 2;
        const r2 = radius + width / 2;

        for (let i = 0; i < segments; i++) {
          const t1 = startAngle + (i / segments) * (endAngle - startAngle);
          const t2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);

          const c1 = Math.cos(t1); const s1 = Math.sin(t1);
          const c2 = Math.cos(t2); const s2 = Math.sin(t2);

          const getP = (r: number, c: number, s: number) => {
            if (axis === 'z') return [r * c, r * s, 0];
            if (axis === 'y') return [r * s, 0, r * c];
            return [0, r * c, r * s];
          };

          const p1 = getP(r1, c1, s1); const p2 = getP(r2, c1, s1);
          const p3 = getP(r1, c2, s2); const p4 = getP(r2, c2, s2);

          // Doble cara para evitar culling
          pushV(p1[0], p1[1], p1[2], color); pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color);
          pushV(p2[0], p2[1], p2[2], color); pushV(p4[0], p4[1], p4[2], color); pushV(p3[0], p3[1], p3[2], color);
          pushV(p1[0], p1[1], p1[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p2[0], p2[1], p2[2], color);
          pushV(p2[0], p2[1], p2[2], color); pushV(p3[0], p3[1], p3[2], color); pushV(p4[0], p4[1], p4[2], color);
        }
      };

      const drawFull = this.isDragging;
      const activeHover = this.hoveredPart;

      const drawX = !drawFull || activeHover === 'rx';
      const drawY = !drawFull || activeHover === 'ry';
      const drawZ = !drawFull || activeHover === 'rz';

      // Magia Unreal: 1/4 círculo en reposo, 360° al arrastrar
      const spanX = (drawFull && activeHover === 'rx') ? Math.PI * 2 : Math.PI / 2;
      const spanY = (drawFull && activeHover === 'ry') ? Math.PI * 2 : Math.PI / 2;
      const spanZ = (drawFull && activeHover === 'rz') ? Math.PI * 2 : Math.PI / 2;

      if (drawX) addFlatArc('x', this.ROT_RADIUS, this.ROT_WIDTH, 0, spanX, getColor('rx', red));
      if (drawY) addFlatArc('y', this.ROT_RADIUS, this.ROT_WIDTH, 0, spanY, getColor('ry', green));
      if (drawZ) addFlatArc('z', this.ROT_RADIUS, this.ROT_WIDTH, 0, spanZ, getColor('rz', blue));

      // Helper para el "Gajo de Pizza" visual
      const addWedge = (axis: 'x' | 'y' | 'z', radius: number, startAngle: number, deltaAngle: number, color: number[]) => {
        if (Math.abs(deltaAngle) < 0.001) return;
        const segments = Math.max(4, Math.floor(48 * (Math.abs(deltaAngle) / (Math.PI * 2))));
        const step = deltaAngle / segments;
        // Hacemos el color un poco más oscuro/transparente simulado restándole intensidad
        const wedgeColor = [color[0] * 0.4, color[1] * 0.4, color[2] * 0.4];

        for (let i = 0; i < segments; i++) {
          const t1 = startAngle + i * step;
          const t2 = startAngle + (i + 1) * step;
          const c1 = Math.cos(t1) * radius; const s1 = Math.sin(t1) * radius;
          const c2 = Math.cos(t2) * radius; const s2 = Math.sin(t2) * radius;

          const getP = (c: number, s: number) => axis === 'z' ? [c, s, 0] : axis === 'y' ? [s, 0, c] : [0, c, s];
          const p1 = getP(c1, s1); const p2 = getP(c2, s2);

          pushV(0, 0, 0, wedgeColor); pushV(p1[0], p1[1], p1[2], wedgeColor); pushV(p2[0], p2[1], p2[2], wedgeColor);
          pushV(0, 0, 0, wedgeColor); pushV(p2[0], p2[1], p2[2], wedgeColor); pushV(p1[0], p1[1], p1[2], wedgeColor);
        }
      };

      const addPointer = (axis: 'x' | 'y' | 'z', radius: number, angle: number, color: number[]) => {
        // Aumentamos el tamaño de 0.5 a 0.85 para que los triángulos destaquen más
        const size = 0.85;
        const tipU = radius; const tipV = 0;
        const blU = radius + size; const blV = -size * 0.4;
        const brU = radius + size; const brV = size * 0.4;

        const c = Math.cos(angle); const s = Math.sin(angle);
        const rot = (u: number, v: number) => [u * c - v * s, u * s + v * c];
        const pTip = rot(tipU, tipV); const pBl = rot(blU, blV); const pBr = rot(brU, brV);

        const getP = (pt: number[]) => axis === 'z' ? [pt[0], pt[1], 0] : axis === 'y' ? [pt[1], 0, pt[0]] : [0, pt[0], pt[1]];
        const v1 = getP(pTip); const v2 = getP(pBl); const v3 = getP(pBr);

        pushV(v1[0], v1[1], v1[2], color); pushV(v2[0], v2[1], v2[2], color); pushV(v3[0], v3[1], v3[2], color);
        pushV(v1[0], v1[1], v1[2], color); pushV(v3[0], v3[1], v3[2], color); pushV(v2[0], v2[1], v2[2], color);
      };

      const addRuler = (axis: 'x' | 'y' | 'z', radius: number, snapDeg: number, color: number[]) => {
        if (snapDeg <= 0) return;
        const step = snapDeg * (Math.PI / 180.0);
        const segments = Math.floor((Math.PI * 2) / step);

        // Aumentamos halfW de 0.015 a 0.04 para que las líneas sean sustancialmente más gruesas y visibles
        const tickLen = 0.3; const halfW = 0.05;

        for (let i = 0; i < segments; i++) {
          const angle = i * step;
          const c = Math.cos(angle); const s = Math.sin(angle);
          const rot = (u: number, v: number) => [u * c - v * s, u * s + v * c];

          const p1 = rot(radius, -halfW); const p2 = rot(radius + tickLen, -halfW);
          const p3 = rot(radius, halfW); const p4 = rot(radius + tickLen, halfW);

          const getP = (pt: number[]) => axis === 'z' ? [pt[0], pt[1], 0] : axis === 'y' ? [pt[1], 0, pt[0]] : [0, pt[0], pt[1]];
          const v1 = getP(p1); const v2 = getP(p2); const v3 = getP(p3); const v4 = getP(p4);

          pushV(v1[0], v1[1], v1[2], color); pushV(v2[0], v2[1], v2[2], color); pushV(v3[0], v3[1], v3[2], color);
          pushV(v2[0], v2[1], v2[2], color); pushV(v4[0], v4[1], v4[2], color); pushV(v3[0], v3[1], v3[2], color);
          pushV(v1[0], v1[1], v1[2], color); pushV(v3[0], v3[1], v3[2], color); pushV(v2[0], v2[1], v2[2], color);
          pushV(v2[0], v2[1], v2[2], color); pushV(v3[0], v3[1], v3[2], color); pushV(v4[0], v4[1], v4[2], color);
        }
      };

      if (this.isDragging && this.hoveredPart) {
        const activeAxis = this.hoveredPart === 'rx' ? 'x' : this.hoveredPart === 'ry' ? 'y' : 'z';
        const visualDelta = this.currentDeltaAngle % (Math.PI * 2);

        // Aumentamos el radio de 0.8 a 0.96 para que el gajo casi toque el borde interno del aro
        const wedgeRadius = this.ROT_RADIUS * 0.96;

        // 1. Dibujar el Abanico (Gajo)
        addWedge(activeAxis, wedgeRadius, this.dragStartAngle, visualDelta, yellow);

        // 2. Dibujar Regla de Grados si el imán está activo
        if (this.currentSnapEnabled && this.currentSnapValue > 0) {
          addRuler(activeAxis, this.ROT_RADIUS, this.currentSnapValue, [0.6, 0.6, 0.6]); // Gris claro
        }

        // 3. Dibujar Triángulos Indicadores
        addPointer(activeAxis, this.ROT_RADIUS, this.dragStartAngle, white); // Origen
        addPointer(activeAxis, this.ROT_RADIUS, this.dragStartAngle + visualDelta, yellow); // Actual
      }
    }

    this.vertexCount = data.length / 6;
    const vertexArray = new Float32Array(data);

    if (!this.vertexBuffer || this.vertexBuffer.size < vertexArray.byteLength) {
      if (this.vertexBuffer) this.vertexBuffer.destroy();
      this.vertexBuffer = this.device.createBuffer({ size: vertexArray.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }

    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexArray);
  }

  private createBuffers(device: GPUDevice, layout: GPUBindGroupLayout): void {
    this.matrixBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.matrixBindGroup = device.createBindGroup({ layout: layout, entries: [{ binding: 0, resource: { buffer: this.matrixBuffer } }] });
  }

  public updateHover(_device: GPUDevice, _queue: GPUQueue, newHover: GizmoPart | null): void {
    if (this.isDragging || this.hoveredPart === newHover) return;
    this.hoveredPart = newHover;
    this.rebuildGeometry();
  }

  private rayBoxIntersect(ro: ArrayLike<number>, rd: ArrayLike<number>, min: ArrayLike<number>, max: ArrayLike<number>): number | null {
    let tmin = -Infinity; let tmax = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(rd[i]) < 0.000001) { if (ro[i] < min[i] || ro[i] > max[i]) return null; }
      else {
        const ood = 1.0 / rd[i];
        let t1 = (min[i] - ro[i]) * ood; let t2 = (max[i] - ro[i]) * ood;
        if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin >= 0 ? tmin : null;
  }

  private rayPlaneIntersect(ro: ArrayLike<number>, rd: ArrayLike<number>, normal: ArrayLike<number>, point: ArrayLike<number>): number | null {
    const denom = rd[0] * normal[0] + rd[1] * normal[1] + rd[2] * normal[2];
    if (Math.abs(denom) > 0.000001) {
      const t = ((point[0] - ro[0]) * normal[0] + (point[1] - ro[1]) * normal[1] + (point[2] - ro[2]) * normal[2]) / denom;
      if (t >= 0) return t;
    }
    return null;
  }

  public hitTest(ray: Ray, camera: SCamera, actor: SActor): GizmoPart | null {
    const dx = actor.x - camera.actor.x; const dy = actor.y - camera.actor.y; const dz = actor.z - camera.actor.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const scale = Math.max(dist * 0.025, 0.15);

    const localOrigin = [(ray.origin[0] - actor.x) / scale, (ray.origin[1] - actor.y) / scale, (ray.origin[2] - actor.z) / scale];
    const localDir = [ray.direction[0], ray.direction[1], ray.direction[2]];

    let closestT = Infinity;
    let hitPart: GizmoPart | null = null;

    if (this.mode === 'translate') {
      for (const [part, box] of Object.entries(this.hitBoxes)) {
        const t = this.rayBoxIntersect(localOrigin, localDir, box.min, box.max);
        if (t !== null && t < closestT) { closestT = t; hitPart = part as GizmoPart; }
      }
    } else if (this.mode === 'rotate') {
      const hitTolerance = this.ROT_WIDTH * 1.5;

      const checkRing = (axis: 'x' | 'y' | 'z', normal: number[]) => {
        // MAGIA ZERO-GC: Usamos matemática pura sin instanciar clases temporales
        const t = this.rayPlaneIntersect(localOrigin, localDir, normal, [0, 0, 0]);
        if (t !== null && t < closestT) {
          const hx = localOrigin[0] + localDir[0] * t;
          const hy = localOrigin[1] + localDir[1] * t;
          const hz = localOrigin[2] + localDir[2] * t;

          let u = 0, v = 0;
          if (axis === 'z') { u = hx; v = hy; }
          if (axis === 'y') { u = hz; v = hx; }
          if (axis === 'x') { u = hy; v = hz; }

          const d = Math.sqrt(u * u + v * v);
          if (Math.abs(d - this.ROT_RADIUS) <= hitTolerance) {
            let angle = Math.atan2(v, u);
            if (angle < 0) angle += Math.PI * 2;

            if (this.isDragging || (angle >= 0 && angle <= Math.PI / 2 + 0.1)) {
              return t;
            }
          }
        }
        return null;
      };

      const tZ = checkRing('z', [0, 0, 1]); if (tZ !== null) { closestT = tZ; hitPart = 'rz'; }
      const tY = checkRing('y', [0, 1, 0]); if (tY !== null) { closestT = tY; hitPart = 'ry'; }
      const tX = checkRing('x', [1, 0, 0]); if (tX !== null) { closestT = tX; hitPart = 'rx'; }
    }

    return hitPart;
  }

  public beginDrag(ray: Ray, camera: SCamera, actor: SActor, snapEnabled: boolean = false, snapValue: number = 0): void {
    if (!this.hoveredPart) return;
    this.isDragging = true;
    this.currentSnapEnabled = snapEnabled;
    this.currentSnapValue = snapValue;
    this.dragStartActorPos = [actor.x, actor.y, actor.z];
    this.dragStartActorRot = [
      actor.rotationX || 0,
      actor.rotationY || 0,
      actor.rotationZ || 0,
      actor.rotationW !== undefined ? actor.rotationW : 1.0
    ];
    this.dragPlanePoint = [actor.x, actor.y, actor.z];
    this.dragAxis = [0, 0, 0];
    this.currentDeltaAngle = 0;

    if (this.mode === 'translate') {
      const viewDir = [camera.actor.x - actor.x, camera.actor.y - actor.y, camera.actor.z - actor.z];
      const vl = Math.sqrt(viewDir[0] ** 2 + viewDir[1] ** 2 + viewDir[2] ** 2);
      if (vl > 0) { viewDir[0] /= vl; viewDir[1] /= vl; viewDir[2] /= vl; }

      if (this.hoveredPart === 'x') { this.dragAxis = [1, 0, 0]; this.dragPlaneNormal = [0, viewDir[1], viewDir[2]]; }
      else if (this.hoveredPart === 'y') { this.dragAxis = [0, 1, 0]; this.dragPlaneNormal = [viewDir[0], 0, viewDir[2]]; }
      else if (this.hoveredPart === 'z') { this.dragAxis = [0, 0, 1]; this.dragPlaneNormal = [viewDir[0], viewDir[1], 0]; }
      else if (this.hoveredPart === 'xy') { this.dragAxis = [1, 1, 0]; this.dragPlaneNormal = [0, 0, 1]; }
      else if (this.hoveredPart === 'xz') { this.dragAxis = [1, 0, 1]; this.dragPlaneNormal = [0, 1, 0]; }
      else if (this.hoveredPart === 'yz') { this.dragAxis = [0, 1, 1]; this.dragPlaneNormal = [1, 0, 0]; }
      else if (this.hoveredPart === 'center') { this.dragAxis = [1, 1, 1]; this.dragPlaneNormal = [viewDir[0], viewDir[1], viewDir[2]]; }
    } else if (this.mode === 'rotate') {
      if (this.hoveredPart === 'rx') { this.dragPlaneNormal = [1, 0, 0]; this.dragAxis = [1, 0, 0]; }
      else if (this.hoveredPart === 'ry') { this.dragPlaneNormal = [0, 1, 0]; this.dragAxis = [0, 1, 0]; }
      else if (this.hoveredPart === 'rz') { this.dragPlaneNormal = [0, 0, 1]; this.dragAxis = [0, 0, 1]; }
    }

    const nl = Math.sqrt(this.dragPlaneNormal[0] ** 2 + this.dragPlaneNormal[1] ** 2 + this.dragPlaneNormal[2] ** 2);
    if (nl > 0) { this.dragPlaneNormal[0] /= nl; this.dragPlaneNormal[1] /= nl; this.dragPlaneNormal[2] /= nl; }

    const t = this.rayPlaneIntersect(ray.origin, ray.direction, this.dragPlaneNormal, this.dragPlanePoint);
    if (t !== null) {
      const hitX = ray.origin[0] + ray.direction[0] * t; const hitY = ray.origin[1] + ray.direction[1] * t; const hitZ = ray.origin[2] + ray.direction[2] * t;

      if (this.mode === 'translate') {
        this.dragOffset = [hitX - actor.x, hitY - actor.y, hitZ - actor.z];
      } else if (this.mode === 'rotate') {
        const dx = hitX - actor.x; const dy = hitY - actor.y; const dz = hitZ - actor.z;
        let u = 0, v = 0;
        if (this.hoveredPart === 'rz') { u = dx; v = dy; }
        if (this.hoveredPart === 'ry') { u = dz; v = dx; }
        if (this.hoveredPart === 'rx') { u = dy; v = dz; }

        const rawAngle = Math.atan2(v, u);

        // MAGIA DE PRECISIÓN: Anclamos el origen visual a la regla de grados si el imán está activo
        if (snapEnabled && snapValue > 0) {
          const snapRad = snapValue * (Math.PI / 180.0);
          this.dragStartAngle = Math.round(rawAngle / snapRad) * snapRad;
        } else {
          this.dragStartAngle = rawAngle;
        }

        // El tracking interno del ratón inicia en el ángulo real para una rotación sin saltos bruscos
        this.dragLastAngle = rawAngle; 
        this.accumulatedAngle = 0;
        this.currentDeltaAngle = 0;
      }
    }

    this.rebuildGeometry();
  }

  public updateDrag(ray: Ray, actor: SActor, snapEnabled: boolean = false, snapValue: number = 0): void {
    if (!this.isDragging) return;
    this.currentSnapEnabled = snapEnabled;
    this.currentSnapValue = snapValue;
    const t = this.rayPlaneIntersect(ray.origin, ray.direction, this.dragPlaneNormal, this.dragPlanePoint);
    if (t !== null) {
      const hitX = ray.origin[0] + ray.direction[0] * t;
      const hitY = ray.origin[1] + ray.direction[1] * t;
      const hitZ = ray.origin[2] + ray.direction[2] * t;

      if (this.mode === 'translate') {
        const hitPos = [hitX, hitY, hitZ];
        let newX = hitPos[0] - this.dragOffset[0]; let newY = hitPos[1] - this.dragOffset[1]; let newZ = hitPos[2] - this.dragOffset[2];
        if (this.dragAxis[0] === 0) newX = this.dragStartActorPos[0]; if (this.dragAxis[1] === 0) newY = this.dragStartActorPos[1]; if (this.dragAxis[2] === 0) newZ = this.dragStartActorPos[2];
        if (snapEnabled && snapValue > 0) {
          if (this.dragAxis[0] !== 0) newX = Math.round(newX / snapValue) * snapValue;
          if (this.dragAxis[1] !== 0) newY = Math.round(newY / snapValue) * snapValue;
          if (this.dragAxis[2] !== 0) newZ = Math.round(newZ / snapValue) * snapValue;
        }
        actor.setPosition(newX, newY, newZ);
      } else if (this.mode === 'rotate') {
        const dx = hitX - actor.x; const dy = hitY - actor.y; const dz = hitZ - actor.z;
        let u = 0, v = 0;
        if (this.hoveredPart === 'rz') { u = dx; v = dy; }
        if (this.hoveredPart === 'ry') { u = dz; v = dx; }
        if (this.hoveredPart === 'rx') { u = dy; v = dz; }

        let currentAngle = Math.atan2(v, u);

        // 1. Extraer solo la diferencia desde el frame anterior
        let angleDiff = currentAngle - this.dragLastAngle;

        // 2. Normalizar la diferencia para tomar la ruta más corta (evita el salto de 360 a 0)
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // 3. Sumar al acumulador continuo (puede crecer al infinito sin resetearse)
        this.accumulatedAngle += angleDiff;
        this.dragLastAngle = currentAngle; // Guardar para el siguiente frame

        let deltaToApply = this.accumulatedAngle;

        // Aplicar Imán de Grados (Snapping)
        if (snapEnabled && snapValue > 0) {
          const snapRad = snapValue * (Math.PI / 180.0);
          deltaToApply = Math.round(this.accumulatedAngle / snapRad) * snapRad;
        }

        this.currentDeltaAngle = deltaToApply;

        // MAGIA CUATERNIÓNICA: Construimos la rotación delta y la multiplicamos por la inicial
        const halfA = deltaToApply * 0.5;
        const s = Math.sin(halfA);
        const qx = this.dragAxis[0] * s;
        const qy = this.dragAxis[1] * s;
        const qz = this.dragAxis[2] * s;
        const qw = Math.cos(halfA);

        const sx = this.dragStartActorRot[0];
        const sy = this.dragStartActorRot[1];
        const sz = this.dragStartActorRot[2];
        const sw = this.dragStartActorRot[3];

        // Rotación Global (q_new = q_delta * q_start)
        const nx = qw * sx + qx * sw + qy * sz - qz * sy;
        const ny = qw * sy - qx * sz + qy * sw + qz * sx;
        const nz = qw * sz + qx * sy - qy * sx + qz * sw;
        const nw = qw * sw - qx * sx - qy * sy - qz * sz;

        // Aplicar de forma segura la rotación completa sin alterar la escala
        if (actor.setRotation) {
          actor.setRotation(nx, ny, nz, nw);
        } else {
          (actor as any).rotationX = nx; (actor as any).rotationY = ny; (actor as any).rotationZ = nz;
          if ((actor as any).rotationW !== undefined) (actor as any).rotationW = nw;
        }

        this.rebuildGeometry();
      }
    }
  }

  public endDrag(): void {
    this.isDragging = false;
    // DEVOLVER AL TRIANGULO DE 1/4
    this.rebuildGeometry();
  }

  public update(queue: GPUQueue, selectedActor: SActor | null): void {
    if (!selectedActor || !this.matrixBuffer) return;
    SMat4.identity(this.gizmoMatrix);
    this.gizmoMatrix[12] = selectedActor.x; this.gizmoMatrix[13] = selectedActor.y; this.gizmoMatrix[14] = selectedActor.z;
    this.gizmoMatrix[16] = 0.0; // Desactivar configuraciones de shader especiales
    queue.writeBuffer(this.matrixBuffer, 0, this.gizmoMatrix);
  }

  public draw(pass: GPURenderPassEncoder): void {
    if (!this.vertexBuffer || !this.matrixBindGroup) return;
    pass.setVertexBuffer(0, this.vertexBuffer); pass.setBindGroup(1, this.matrixBindGroup); pass.draw(this.vertexCount);
  }
}
