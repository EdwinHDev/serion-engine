import { SActor } from '../core/SActor';
import { SMat4 } from '../math/SMath';

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

  constructor(
    // Respetar la escala de 1 unidad = 1 centimetro
    public readonly actor: SActor,
    public fov: number = 45,
    public near: number = 10.0, // 10 cm (evita Z-fighting)
    public far: number = 1000000.0 // 10 km (distancia AAA)
  ) { }

  /**
   * Calcula y retorna la matriz combinada View-Projection.
   */
  public getViewProjectionMatrix(): Float32Array {
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

    // Miramos desde la posición del actor hacia (Posición + Forward)
    SMat4.lookAt(this.viewMatrix,
      [px, py, pz],
      [px + forwardX, py + forwardY, pz + forwardZ],
      [0, 0, 1] // Z es Up siempre
    );

    // 4. Multiplicación final Proj * View
    SMat4.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);

    return this.viewProjMatrix;
  }
}
