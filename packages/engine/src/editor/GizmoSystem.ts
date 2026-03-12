import { SActor } from '../core/SActor';
import { Ray } from '../math/Ray';
import { SCamera } from '../camera/SCamera';
import { GizmoGeometryBuilder, GizmoState, GIZMO_ROT_RADIUS, GIZMO_ROT_WIDTH, GizmoPart, TransformMode } from './GizmoGeometryBuilder';

export class GizmoSystem {
  private device: GPUDevice;
  private vertexBuffer: GPUBuffer | null = null;
  private matrixBuffer: GPUBuffer | null = null;
  public matrixBindGroup: GPUBindGroup | null = null;

  private gizmoMatrix = new Float32Array(20);
  private vertexCount = 0;

  public mode: TransformMode = 'translate';
  public space: 'world' | 'local' = 'world';
  public hoveredPart: GizmoPart | null = null;
  public isDragging = false;

  public dragStartAngle = 0;
  public dragLastAngle = 0;
  public accumulatedAngle = 0;
  public currentDeltaAngle = 0;
  public dragStartActorRot = [0, 0, 0, 1]; // Ahora almacena X, Y, Z, W
  public dragStartActorScale = [1, 1, 1];

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
    const state: GizmoState = {
      mode: this.mode,
      hoveredPart: this.hoveredPart,
      isDragging: this.isDragging,
      dragStartAngle: this.dragStartAngle,
      currentDeltaAngle: this.currentDeltaAngle,
      snapEnabled: this.currentSnapEnabled,
      snapValue: this.currentSnapValue
    };

    const vertexArray = GizmoGeometryBuilder.build(state);
    this.vertexCount = vertexArray.length / 6;

    if (!this.vertexBuffer || this.vertexBuffer.size < vertexArray.byteLength) {
      if (this.vertexBuffer) this.vertexBuffer.destroy();
      this.vertexBuffer = this.device.createBuffer({ 
        size: vertexArray.byteLength, 
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST 
      });
    }
    
    this.device.queue.writeBuffer(this.vertexBuffer as GPUBuffer, 0, vertexArray as any);
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

    const m = this.gizmoMatrix;
    const rDirX = ray.direction[0], rDirY = ray.direction[1], rDirZ = ray.direction[2];
    const ox = (ray.origin[0] - actor.x) / scale, oy = (ray.origin[1] - actor.y) / scale, oz = (ray.origin[2] - actor.z) / scale;

    // Inversa de rotación (Transpuesta) para enviar el rayo al espacio local del Gizmo
    const localDir = [rDirX * m[0] + rDirY * m[1] + rDirZ * m[2], rDirX * m[4] + rDirY * m[5] + rDirZ * m[6], rDirX * m[8] + rDirY * m[9] + rDirZ * m[10]];
    const localOrigin = [ox * m[0] + oy * m[1] + oz * m[2], ox * m[4] + oy * m[5] + oz * m[6], ox * m[8] + oy * m[9] + oz * m[10]];

    let closestT = Infinity;
    let hitPart: GizmoPart | null = null;

    if (this.mode === 'translate' || this.mode === 'scale') {
      for (const [part, box] of Object.entries(this.hitBoxes)) {
        const t = this.rayBoxIntersect(localOrigin, localDir, box.min, box.max);
        if (t !== null && t < closestT) { closestT = t; hitPart = part as GizmoPart; }
      }
    } else if (this.mode === 'rotate') {
      const hitTolerance = GIZMO_ROT_WIDTH * 1.5;

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
          if (Math.abs(d - GIZMO_ROT_RADIUS) <= hitTolerance) {
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
    this.dragStartActorScale = [actor.scaleX || 1, actor.scaleY || 1, actor.scaleZ || 1];
    this.dragStartActorRot = [
      actor.rotationX || 0,
      actor.rotationY || 0,
      actor.rotationZ || 0,
      actor.rotationW !== undefined ? actor.rotationW : 1.0
    ];
    this.dragPlanePoint = [actor.x, actor.y, actor.z];
    this.dragAxis = [0, 0, 0];
    this.currentDeltaAngle = 0;

    let localAxis = [0, 0, 0]; let localNormal = [0, 0, 0];
    const m = this.gizmoMatrix;

    if (this.mode === 'translate' || this.mode === 'scale') {
      const vx = camera.actor.x - actor.x; const vy = camera.actor.y - actor.y; const vz = camera.actor.z - actor.z;
      const lvx = vx * m[0] + vy * m[1] + vz * m[2]; const lvy = vx * m[4] + vy * m[5] + vz * m[6]; const lvz = vx * m[8] + vy * m[9] + vz * m[10];
      const vl = Math.sqrt(lvx * lvx + lvy * lvy + lvz * lvz);
      const lDir = vl > 0 ? [lvx / vl, lvy / vl, lvz / vl] : [0, 0, 1];

      if (this.hoveredPart === 'x') { localAxis = [1, 0, 0]; localNormal = [0, lDir[1], lDir[2]]; }
      else if (this.hoveredPart === 'y') { localAxis = [0, 1, 0]; localNormal = [lDir[0], 0, lDir[2]]; }
      else if (this.hoveredPart === 'z') { localAxis = [0, 0, 1]; localNormal = [lDir[0], lDir[1], 0]; }
      else if (this.hoveredPart === 'xy') { localAxis = [1, 1, 0]; localNormal = [0, 0, 1]; }
      else if (this.hoveredPart === 'xz') { localAxis = [1, 0, 1]; localNormal = [0, 1, 0]; }
      else if (this.hoveredPart === 'yz') { localAxis = [0, 1, 1]; localNormal = [1, 0, 0]; }
      else if (this.hoveredPart === 'center') { localAxis = [1, 1, 1]; localNormal = lDir; }
    } else if (this.mode === 'rotate') {
      if (this.hoveredPart === 'rx') { localAxis = [1, 0, 0]; localNormal = [1, 0, 0]; }
      else if (this.hoveredPart === 'ry') { localAxis = [0, 1, 0]; localNormal = [0, 1, 0]; }
      else if (this.hoveredPart === 'rz') { localAxis = [0, 0, 1]; localNormal = [0, 0, 1]; }
    }

    // Rotar ejes locales al mundo
    this.dragAxis = [localAxis[0] * m[0] + localAxis[1] * m[4] + localAxis[2] * m[8], localAxis[0] * m[1] + localAxis[1] * m[5] + localAxis[2] * m[9], localAxis[0] * m[2] + localAxis[1] * m[6] + localAxis[2] * m[10]];
    this.dragPlaneNormal = [localNormal[0] * m[0] + localNormal[1] * m[4] + localNormal[2] * m[8], localNormal[0] * m[1] + localNormal[1] * m[5] + localNormal[2] * m[9], localNormal[0] * m[2] + localNormal[1] * m[6] + localNormal[2] * m[10]];

    const nl = Math.sqrt(this.dragPlaneNormal[0] ** 2 + this.dragPlaneNormal[1] ** 2 + this.dragPlaneNormal[2] ** 2);
    if (nl > 0) { this.dragPlaneNormal[0] /= nl; this.dragPlaneNormal[1] /= nl; this.dragPlaneNormal[2] /= nl; }

    const t = this.rayPlaneIntersect(ray.origin, ray.direction, this.dragPlaneNormal, this.dragPlanePoint);
    if (t !== null) {
      const hitX = ray.origin[0] + ray.direction[0] * t; const hitY = ray.origin[1] + ray.direction[1] * t; const hitZ = ray.origin[2] + ray.direction[2] * t;

      // FIX CRÍTICO: Capturar el offset inicial también para la escala
      if (this.mode === 'translate' || this.mode === 'scale') {
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
        // FIX CRÍTICO: El delta total se calcula contra el inicio absoluto, no contra el actor en movimiento
        const totalDx = (hitX - this.dragOffset[0]) - this.dragStartActorPos[0];
        const totalDy = (hitY - this.dragOffset[1]) - this.dragStartActorPos[1];
        const totalDz = (hitZ - this.dragOffset[2]) - this.dragStartActorPos[2];

        let moveX = totalDx, moveY = totalDy, moveZ = totalDz;

        if (this.hoveredPart !== 'center') {
          if (this.hoveredPart === 'x' || this.hoveredPart === 'y' || this.hoveredPart === 'z') {
            // Proyección en 1 Eje (Vector Dot Product)
            const al = Math.sqrt(this.dragAxis[0] ** 2 + this.dragAxis[1] ** 2 + this.dragAxis[2] ** 2);
            const nx = this.dragAxis[0] / al, ny = this.dragAxis[1] / al, nz = this.dragAxis[2] / al;
            let dot = totalDx * nx + totalDy * ny + totalDz * nz;

            if (snapEnabled && snapValue > 0) dot = Math.round(dot / snapValue) * snapValue;
            moveX = nx * dot; moveY = ny * dot; moveZ = nz * dot;
          } else {
            // Proyección en Plano
            const dotN = totalDx * this.dragPlaneNormal[0] + totalDy * this.dragPlaneNormal[1] + totalDz * this.dragPlaneNormal[2];
            moveX = totalDx - this.dragPlaneNormal[0] * dotN;
            moveY = totalDy - this.dragPlaneNormal[1] * dotN;
            moveZ = totalDz - this.dragPlaneNormal[2] * dotN;

            if (snapEnabled && snapValue > 0) {
              moveX = Math.round(moveX / snapValue) * snapValue;
              moveY = Math.round(moveY / snapValue) * snapValue;
              moveZ = Math.round(moveZ / snapValue) * snapValue;
            }
          }
        } else {
          if (snapEnabled && snapValue > 0) {
            moveX = Math.round(moveX / snapValue) * snapValue;
            moveY = Math.round(moveY / snapValue) * snapValue;
            moveZ = Math.round(moveZ / snapValue) * snapValue;
          }
        }

        // Se aplica siempre el movimiento total al punto de anclaje inicial estático
        actor.setPosition(this.dragStartActorPos[0] + moveX, this.dragStartActorPos[1] + moveY, this.dragStartActorPos[2] + moveZ);
      } else if (this.mode === 'scale') {
        // Matemática Unreal: Proporción geométrica sobre los ejes activos
        let startD = 0; let currentD = 0;
        if (this.dragAxis[0] !== 0) { startD += this.dragOffset[0] ** 2; currentD += (hitX - actor.x) ** 2; }
        if (this.dragAxis[1] !== 0) { startD += this.dragOffset[1] ** 2; currentD += (hitY - actor.y) ** 2; }
        if (this.dragAxis[2] !== 0) { startD += this.dragOffset[2] ** 2; currentD += (hitZ - actor.z) ** 2; }

        startD = Math.sqrt(startD);
        currentD = Math.sqrt(currentD);

        let multiplier = startD > 0.0001 ? (currentD / startD) : 1.0;

        // Detectar inversión (Escala Negativa / Espejo) si se tira del eje hacia atrás
        let sign = 1;
        if (this.hoveredPart === 'x') sign = Math.sign((hitX - actor.x) * this.dragOffset[0]);
        else if (this.hoveredPart === 'y') sign = Math.sign((hitY - actor.y) * this.dragOffset[1]);
        else if (this.hoveredPart === 'z') sign = Math.sign((hitZ - actor.z) * this.dragOffset[2]);

        multiplier *= (sign === 0 ? 1 : sign);

        // Aplicar Imán de Escala (Snapping)
        if (snapEnabled && snapValue > 0) {
          multiplier = Math.round(multiplier / snapValue) * snapValue;
          // Evitar que colapse exactamente a 0 absoluto para no destruir la matriz
          if (Math.abs(multiplier) < 0.001) multiplier = snapValue > 0.001 ? snapValue : 0.001;
        }

        const newScaleX = this.dragStartActorScale[0] * (this.dragAxis[0] !== 0 ? multiplier : 1.0);
        const newScaleY = this.dragStartActorScale[1] * (this.dragAxis[1] !== 0 ? multiplier : 1.0);
        const newScaleZ = this.dragStartActorScale[2] * (this.dragAxis[2] !== 0 ? multiplier : 1.0);

        if (actor.setScale) {
          actor.setScale(newScaleX, newScaleY, newScaleZ);
        } else {
          actor.scaleX = newScaleX; actor.scaleY = newScaleY; actor.scaleZ = newScaleZ;
        }
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
          actor.rotationX = nx; actor.rotationY = ny; actor.rotationZ = nz;
          actor.rotationW = nw;
        }

        this.rebuildGeometry();
      }
    }
  }

  public endDrag(actor: SActor | null): void {
    if (this.isDragging && actor) {
      const event = new CustomEvent('serion:transform-ended', {
        detail: {
          actorId: actor.id,
          start: {
            p: [...this.dragStartActorPos],
            r: [...this.dragStartActorRot],
            s: [...this.dragStartActorScale]
          },
          end: {
            p: [actor.x, actor.y, actor.z],
            r: [actor.rotationX || 0, actor.rotationY || 0, actor.rotationZ || 0, actor.rotationW !== undefined ? actor.rotationW : 1],
            s: [actor.scaleX || 1, actor.scaleY || 1, actor.scaleZ || 1]
          }
        }
      });
      window.dispatchEvent(event);
    }
    this.isDragging = false;
    // DEVOLVER AL TRIANGULO DE 1/4
    this.rebuildGeometry();
  }

  public update(queue: GPUQueue, selectedActor: SActor | null): void {
    if (!selectedActor || !this.matrixBuffer) return;

    if (this.space === 'local' && this.mode !== 'scale') { // Escala siempre se representa visualmente local/alineada
      const qx = selectedActor.rotationX || 0; const qy = selectedActor.rotationY || 0;
      const qz = selectedActor.rotationZ || 0; const qw = selectedActor.rotationW !== undefined ? selectedActor.rotationW : 1.0;

      const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
      const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
      const wx = qw * x2, wy = qw * y2, wz = qw * z2;

      this.gizmoMatrix[0] = 1 - (yy + zz); this.gizmoMatrix[1] = xy + wz; this.gizmoMatrix[2] = xz - wy; this.gizmoMatrix[3] = 0;
      this.gizmoMatrix[4] = xy - wz; this.gizmoMatrix[5] = 1 - (xx + zz); this.gizmoMatrix[6] = yz + wx; this.gizmoMatrix[7] = 0;
      this.gizmoMatrix[8] = xz + wy; this.gizmoMatrix[9] = yz - wx; this.gizmoMatrix[10] = 1 - (xx + yy); this.gizmoMatrix[11] = 0;
    } else {
      this.gizmoMatrix[0] = 1; this.gizmoMatrix[1] = 0; this.gizmoMatrix[2] = 0; this.gizmoMatrix[3] = 0;
      this.gizmoMatrix[4] = 0; this.gizmoMatrix[5] = 1; this.gizmoMatrix[6] = 0; this.gizmoMatrix[7] = 0;
      this.gizmoMatrix[8] = 0; this.gizmoMatrix[9] = 0; this.gizmoMatrix[10] = 1; this.gizmoMatrix[11] = 0;
    }

    this.gizmoMatrix[12] = selectedActor.x; this.gizmoMatrix[13] = selectedActor.y; this.gizmoMatrix[14] = selectedActor.z; this.gizmoMatrix[15] = 1;
    this.gizmoMatrix[16] = this.mode === 'rotate' ? 1.0 : 0.0;

    queue.writeBuffer(this.matrixBuffer, 0, this.gizmoMatrix);
  }

  public draw(pass: GPURenderPassEncoder): void {
    if (!this.vertexBuffer || !this.matrixBindGroup) return;
    pass.setVertexBuffer(0, this.vertexBuffer); pass.setBindGroup(1, this.matrixBindGroup); pass.draw(this.vertexCount);
  }
}
