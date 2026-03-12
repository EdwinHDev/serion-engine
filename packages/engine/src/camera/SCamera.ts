import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';
import { Ray } from '../math/Ray';

/**
 * SCamera - Componente de cámara desacoplado.
 * Gestiona la óptica y la orientación (Yaw/Pitch) bajo el estándar Z-Up.
 */
export class SCamera {
  public aspectRatio: number = 16 / 9;

  // Orientación en grados
  public yaw: number = -90;
  public pitch: number = 0;

  private viewMatrix = new Float32Array(16);
  private projMatrix = new Float32Array(16);
  private viewProjMatrix = new Float32Array(16);
  private invViewProjMatrix = new Float32Array(16);

  constructor(
    // Respetar la escala de 1 unidad = 1 centimetro
    public readonly actor: SActor,
    public fov: number = 45,
    public near: number = 10.0, // 10 cm (evita Z-fighting)
    public far: number = 1000000.0 // 10 km (distancia AAA)
  ) { }

  /**
   * Retorna la matriz de vista actualizada de la cámara.
   */
  public getViewMatrix(): Float32Array {
    this.updateMatrices();
    return this.viewMatrix;
  }

  /**
   * Calcula y retorna la matriz combinada View-Projection.
   */
  public getViewProjectionMatrix(): Float32Array {
    this.updateMatrices();
    SMat4.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);
    return this.viewProjMatrix;
  }

  /**
   * Desproyecta un punto en coordenadas de pantalla normalizadas (NDC) a un rayo en el espacio del mundo.
   */
  public unprojectRay(ndcX: number, ndcY: number, outRay: Ray): void {
    const vp = this.getViewProjectionMatrix();
    SMat4.invert(this.invViewProjMatrix, vp);

    const inv = this.invViewProjMatrix;

    // Punto Cercano (Z = 0.0 en NDC para WebGPU/Z-Up resuelto)
    let w1 = inv[3] * ndcX + inv[7] * ndcY + inv[11] * 0.0 + inv[15];
    w1 = w1 || 1.0;
    const originX = (inv[0] * ndcX + inv[4] * ndcY + inv[8] * 0.0 + inv[12]) / w1;
    const originY = (inv[1] * ndcX + inv[5] * ndcY + inv[9] * 0.0 + inv[13]) / w1;
    const originZ = (inv[2] * ndcX + inv[6] * ndcY + inv[10] * 0.0 + inv[14]) / w1;

    // Punto Lejano (Z = 1.0)
    let w2 = inv[3] * ndcX + inv[7] * ndcY + inv[11] * 1.0 + inv[15];
    w2 = w2 || 1.0;
    const targetX = (inv[0] * ndcX + inv[4] * ndcY + inv[8] * 1.0 + inv[12]) / w2;
    const targetY = (inv[1] * ndcX + inv[5] * ndcY + inv[9] * 1.0 + inv[13]) / w2;
    const targetZ = (inv[2] * ndcX + inv[6] * ndcY + inv[10] * 1.0 + inv[14]) / w2;

    const dirX = targetX - originX;
    const dirY = targetY - originY;
    const dirZ = targetZ - originZ;
    const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    
    outRay.set(originX, originY, originZ, dirX / len, dirY / len, dirZ / len);
  }

  /**
   * Actualiza las matrices de vista y proyección basadas en el estado actual.
   */
  private updateMatrices(): void {
    // 1. Matriz de Proyección
    const fovRad = (this.fov * Math.PI) / 180;
    SMat4.perspective(this.projMatrix, fovRad, this.aspectRatio, this.near, this.far);

    // 2. Cálculo de Vector Forward (Z-Up Standard)
    const radYaw = this.yaw * (Math.PI / 180);
    const radPitch = this.pitch * (Math.PI / 180);

    const forwardX = Math.cos(radYaw) * Math.cos(radPitch);
    const forwardY = Math.sin(radYaw) * Math.cos(radPitch);
    const forwardZ = Math.sin(radPitch);

    // 3. Matriz de Vista (LookAt)
    const px = this.actor.x;
    const py = this.actor.y;
    const pz = this.actor.z;

    SMat4.lookAt(this.viewMatrix,
      [px, py, pz],
      [px + forwardX, py + forwardY, pz + forwardZ],
      [0, 0, 1]
    );
  }
}
