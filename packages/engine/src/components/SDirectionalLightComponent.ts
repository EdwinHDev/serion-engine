/**
 * SDirectionalLightComponent.ts - Componente para iluminación direccional (Sol).
 * Capa 13.3: Desacoplamiento de Iluminación.
 */
export class SDirectionalLightComponent {
  public color = new Float32Array([1.0, 1.0, 1.0]);
  public intensity = 100000.0; // Lux (Luxes en superficie)
  public baseIntensity = 120000.0; // Intensidad base para el sistema de atmósfera
  public direction = new Float32Array([0.5, 0.5, -1.0]);

  constructor() {
    this.normalizeDirection();
  }

  public setColor(r: number, g: number, b: number): void {
    this.color[0] = r;
    this.color[1] = g;
    this.color[2] = b;
  }

  public setDirection(x: number, y: number, z: number): void {
    this.direction[0] = x;
    this.direction[1] = y;
    this.direction[2] = z;
    this.normalizeDirection();
  }

  public setIntensity(lux: number): void {
    this.baseIntensity = lux;
  }

  private normalizeDirection(): void {
    const x = this.direction[0];
    const y = this.direction[1];
    const z = this.direction[2];
    const mag = Math.sqrt(x * x + y * y + z * z);
    if (mag > 0) {
      this.direction[0] /= mag;
      this.direction[1] /= mag;
      this.direction[2] /= mag;
    }
  }
}
