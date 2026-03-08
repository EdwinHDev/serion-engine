/**
 * SMaterialComponent
 * Define las propiedades físicas de un objeto para el modelo de iluminación PBR.
 * Capa 11: Metallic/Roughness Workflow.
 */
export class SMaterialComponent {
  /** [R, G, B, A] */
  public baseColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);

  /** [Metallic, Roughness, Specular, Padding] */
  public pbrParams = new Float32Array([0.0, 0.5, 0.5, 0.0]);

  /**
   * Establece el color base del material.
   */
  public setColor(r: number, g: number, b: number, a = 1.0): void {
    this.baseColor[0] = r;
    this.baseColor[1] = g;
    this.baseColor[2] = b;
    this.baseColor[3] = a;
  }

  /**
   * Establece los parámetros físicos PBR.
   * @param metallic 0.0 (Dieléctrico) a 1.0 (Conductor/Metal)
   * @param roughness 0.0 (Espejo) a 1.0 (Mate)
   * @param specular Intensidad especular (defecto 0.5)
   */
  public setPBR(metallic: number, roughness: number, specular = 0.5): void {
    this.pbrParams[0] = metallic;
    this.pbrParams[1] = roughness;
    this.pbrParams[2] = specular;
    this.pbrParams[3] = 0.0; // Padding
  }
}
