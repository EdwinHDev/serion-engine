/**
 * SAtmosphereComponent.ts - Componente para configuración de atmósfera y ambiente.
 * Capa 13.3: Desacoplamiento de Iluminación.
 */
export class SAtmosphereComponent {
  public skyColor = new Float32Array([0.5, 0.7, 1.0]);
  public groundColor = new Float32Array([0.2, 0.2, 0.2]);
  public ambientIntensity = 1.0;

  public setSkyColor(r: number, g: number, b: number): void {
    this.skyColor[0] = r;
    this.skyColor[1] = g;
    this.skyColor[2] = b;
  }

  public setGroundColor(r: number, g: number, b: number): void {
    this.groundColor[0] = r;
    this.groundColor[1] = g;
    this.groundColor[2] = b;
  }

  public setAmbientIntensity(intensity: number): void {
    this.ambientIntensity = intensity;
  }
}
