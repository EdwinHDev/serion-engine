/**
 * SAtmosphereComponent.ts - Configuración de Atmósfera Física (Nishita).
 * Capa 13.9: Modelo de dispersión de Rayleigh y Mie.
 */
export class SAtmosphereComponent {
  // Coeficientes de dispersión (Representan el color y densidad de la atmósfera)
  public rayleighScattering = new Float32Array([3.8e-6, 13.5e-6, 33.1e-6]);
  public mieScattering = 3.9e-6;

  // Escala Planetaria (metros)
  public planetRadius = 6360000.0;
  public atmosphereRadius = 6420000.0;

  public ambientIntensity = 1.0;

  /**
   * Buffers internos calculados por el AtmosphereSystem (Zero-GC).
   * Estos colores se inyectan en el sombreador PBR para el AO hemisférico.
   */
  public readonly _calculatedSkyColor = new Float32Array([0.05, 0.1, 0.3]);
  public readonly _calculatedGroundColor = new Float32Array([0.02, 0.02, 0.02]);
}
