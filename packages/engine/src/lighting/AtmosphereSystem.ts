import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';

/**
 * AtmosphereSystem - Orquestador de la simulación atmosférica en CPU.
 * Capa 13.9: Cálculo de Transmitancia y Tinte Solar dinámico.
 */
export class AtmosphereSystem {
  /**
   * Calcula la transmitancia atmosférica (atenuación y tinte) basada en la elevación del sol.
   * Actualiza proactivamente el componente de luz para que el PBR reaccione.
   */
  public static updateTransmittance(sun: SDirectionalLightComponent, atmo: SAtmosphereComponent): void {
    const sunDir = sun.direction;
    // En Z-Up, sunDir[2] es la elevación invertida (-1 mediodía, 0 horizonte)
    const elevation = Math.max(0.01, -sunDir[2]);

    // 1. Simular Transmitancia (Aproximación empírica rápida de Rayleigh)
    // A medida que el sol baja al horizonte, el azul se dispersa más.
    const r = 1.0;
    const g = Math.pow(elevation, 0.4);
    const b = Math.pow(elevation, 0.8);

    // Atenuación de intensidad física (Extinción)
    const extinction = Math.pow(elevation, 0.5);
    const baseLux = 120000.0; // Intensidad de un sol pleno

    sun.intensity = baseLux * extinction;
    sun.setColor(r, g, b);

    // 2. Generar aproximación de Sky/Ground Color para el sombreador PBR
    // Esto mantiene el AO hemisferico visualmente coherente con el cielo procedural
    atmo._calculatedSkyColor[0] = 0.1 * r;
    atmo._calculatedSkyColor[1] = 0.2 * g;
    atmo._calculatedSkyColor[2] = 0.5 * b;

    atmo._calculatedGroundColor[0] = r * 0.05;
    atmo._calculatedGroundColor[1] = g * 0.05;
    atmo._calculatedGroundColor[2] = b * 0.05;
  }
}
