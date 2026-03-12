import { AABB } from './AABB';

/**
 * Ray - Utilidad de Raycasting.
 * Optimizada para Zero-GC usando arrays tipados.
 */
export class Ray {
  public origin = new Float32Array(3);
  public direction = new Float32Array(3);

  // Buffer estático interno para no instanciar vectores intermedios
  private static readonly EPSILON = 1e-6;

  /**
   * Configura el origen y la dirección del rayo.
   * La dirección debe venir pre-normalizada.
   */
  public set(originX: number, originY: number, originZ: number, dirX: number, dirY: number, dirZ: number): void {
    this.origin[0] = originX;
    this.origin[1] = originY;
    this.origin[2] = originZ;
    this.direction[0] = dirX;
    this.direction[1] = dirY;
    this.direction[2] = dirZ;
  }

  /**
   * Ray-AABB Intersection usando "Slab Method".
   * Algoritmo extremadamente rápido y Zero-GC.
   * @param aabb El AABB con el que intersectar.
   * @returns La distancia 't' a la intersección si ocurre, de lo contrario null.
   */
  public intersectAABB(aabb: AABB): number | null {
    let tmin = 0.0;
    let tmax = Infinity;

    for (let i = 0; i < 3; i++) {
      if (Math.abs(this.direction[i]) < Ray.EPSILON) {
        // El rayo es paralelo al eje i
        if (this.origin[i] < aabb.min[i] || this.origin[i] > aabb.max[i]) {
          return null; // Paralelo pero completamente afuera del AABB
        }
      } else {
        const invD = 1.0 / this.direction[i];
        let t1 = (aabb.min[i] - this.origin[i]) * invD;
        let t2 = (aabb.max[i] - this.origin[i]) * invD;

        if (t1 > t2) {
          const temp = t1;
          t1 = t2;
          t2 = temp;
        }

        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);

        if (tmin > tmax) return null;
      }
    }

    if (tmax < 0) return null; // El AABB está detrás del origen del rayo
    return tmin >= 0 ? tmin : tmax; // Si tmin es negativo, el origen está dentro del AABB
  }
}
