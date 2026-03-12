import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';
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

    const localOrigin = [(ray.origin[0] - actor.x) / scale, (ray.origin[1] - actor.y) / scale, (ray.origin[2] - actor.z) / scale];
    const localDir = [ray.direction[0], ray.direction[1], ray.direction[2]];

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

    if (this.mode === 'translate' || this.mode === 'scale') {
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
        const hitPos = [hitX, hitY, hitZ];
        let newX = hitPos[0] - this.dragOffset[0]; let newY = hitPos[1] - this.dragOffset[1]; let newZ = hitPos[2] - this.dragOffset[2];
        if (this.dragAxis[0] === 0) newX = this.dragStartActorPos[0]; if (this.dragAxis[1] === 0) newY = this.dragStartActorPos[1]; if (this.dragAxis[2] === 0) newZ = this.dragStartActorPos[2];
        if (snapEnabled && snapValue > 0) {
          if (this.dragAxis[0] !== 0) newX = Math.round(newX / snapValue) * snapValue;
          if (this.dragAxis[1] !== 0) newY = Math.round(newY / snapValue) * snapValue;
          if (this.dragAxis[2] !== 0) newZ = Math.round(newZ / snapValue) * snapValue;
        }
        actor.setPosition(newX, newY, newZ);
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
