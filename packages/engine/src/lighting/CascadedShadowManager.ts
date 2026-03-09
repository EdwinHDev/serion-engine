import { SCamera } from '../camera/SCamera';
import { SGlobalEnvironmentData } from '../core/SGlobalEnvironmentData';
import { SMat4 } from '../math/SMath';

/**
 * CascadedShadowManager.ts - Cálculo dinámico de cascadas de sombras.
 * Capa 12.6: Hito de matemáticas de frustum y proyecciones envolventes.
 * Zero-GC: Reutiliza arreglos para evitar recolección de basura.
 */
export class CascadedShadowManager {
  // Configuración de splits
  private readonly nearSplit = 1500.0; // 15m
  private readonly farSplit = 15000.0; // 150m

  // Temporales Zero-GC
  private frustumCornersNDC = [
    new Float32Array([-1, 1, 0]), new Float32Array([1, 1, 0]),
    new Float32Array([1, -1, 0]), new Float32Array([-1, -1, 0]),
    new Float32Array([-1, 1, 1]), new Float32Array([1, 1, 1]),
    new Float32Array([1, -1, 1]), new Float32Array([-1, -1, 1])
  ];
  private worldCorners = Array.from({ length: 8 }, () => new Float32Array(3));
  private lightCorners = Array.from({ length: 8 }, () => new Float32Array(3));

  private invVP = new Float32Array(16);
  private tempVP = new Float32Array(16);
  private tempProj = new Float32Array(16);
  private lightView = new Float32Array(16);
  private lightOrtho = new Float32Array(16);
  private lightViewProj = new Float32Array(16);

  private centroid = new Float32Array(3);
  private lightPos = new Float32Array(3);
  private upVector = new Float32Array([0, 0, 1]);

  public update(camera: SCamera, sunDir: Float32Array, globalEnv: SGlobalEnvironmentData): void {
    // 1. Establecer splits en el entorno
    globalEnv.setCascadeSplits(this.nearSplit, this.farSplit);

    // 2. Procesar cada cascada
    this.calculateCascade(0, camera, 10, this.nearSplit, sunDir, globalEnv);
    this.calculateCascade(1, camera, this.nearSplit, this.farSplit, sunDir, globalEnv);
  }

  private calculateCascade(index: number, camera: SCamera, near: number, far: number, sunDir: Float32Array, globalEnv: SGlobalEnvironmentData): void {
    // A. Calcular la matriz VP de la cámara para este rango específico
    const fovRad = (camera.fov * Math.PI) / 180;
    SMat4.perspective(this.tempProj, fovRad, camera.aspectRatio, near, far);
    SMat4.multiply(this.tempVP, this.tempProj, camera.getViewMatrix());

    // B. Obtener esquinas en World Space
    if (!SMat4.invert(this.invVP, this.tempVP)) return;

    this.centroid.fill(0);
    for (let i = 0; i < 8; i++) {
      SMat4.transformMat4(this.worldCorners[i], this.frustumCornersNDC[i], this.invVP);
      this.centroid[0] += this.worldCorners[i][0];
      this.centroid[1] += this.worldCorners[i][1];
      this.centroid[2] += this.worldCorners[i][2];
    }

    this.centroid[0] /= 8;
    this.centroid[1] /= 8;
    this.centroid[2] /= 8;

    // C. Posicionar la "cámara" de la luz
    // Retrocedemos lo suficiente para capturar objetos fuera del frustum que proyectan sombras dentro
    const distance = far * 0.5;
    this.lightPos[0] = this.centroid[0] - sunDir[0] * distance;
    this.lightPos[1] = this.centroid[1] - sunDir[1] * distance;
    this.lightPos[2] = this.centroid[2] - sunDir[2] * distance;

    SMat4.lookAt(this.lightView, this.lightPos, this.centroid, this.upVector);

    // D. Encontrar límites en Light Space
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < 8; i++) {
      SMat4.transformMat4(this.lightCorners[i], this.worldCorners[i], this.lightView);
      const c = this.lightCorners[i];
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
      minZ = Math.min(minZ, c[2]); maxZ = Math.max(maxZ, c[2]);
    }

    // E. Crear la proyección ortográfica envolvente
    // Extendemos un poco hacia atrás (Z) para evitar clipping de objetos altos fuera de cámara
    const zExtend = 10000;
    SMat4.ortho(this.lightOrtho, minX, maxX, minY, maxY, minZ - zExtend, maxZ + 2000);

    // F. Final VP y Envío
    SMat4.multiply(this.lightViewProj, this.lightOrtho, this.lightView);

    if (index === 0) {
      globalEnv.setLightViewProj0(this.lightViewProj);
    } else {
      globalEnv.setLightViewProj1(this.lightViewProj);
    }
  }
}
