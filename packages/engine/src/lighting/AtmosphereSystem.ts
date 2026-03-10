import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';

/**
 * AtmosphereSystem - Orquestador de la simulación atmosférica en CPU.
 * Capa 13.9: Transmitancia Física y Paletas Cinematográficas.
 */
export class AtmosphereSystem {
  public static updateTransmittance(sun: SDirectionalLightComponent, atmo: SAtmosphereComponent): void {
    const sunDir = sun.direction;
    const elevation = Math.max(0.001, -sunDir[2]);

    // 1. Transmitancia Física (La absorción del aire)
    const r = 1.0;
    // Mantenemos el verde alto un poco más para los dorados, luego cae en picado al rojo
    const g = Math.pow(elevation, 0.45);
    // El azul se dispersa rápido, dejando los magentas y naranjas del atardecer
    const b = Math.max(0.0, Math.pow(elevation, 0.75) - 0.05);

    const extinction = Math.pow(elevation, 0.25);
    const baseLux = sun.baseIntensity;

    sun.intensity = baseLux * extinction;
    sun.setColor(r, g, b);

    // 2. Colores del Cielo (Paleta Cinematográfica)
    // Zenith (Arriba) - Azul naval profundo que cae a violeta oscuro en la noche
    atmo._calculatedSkyColor[0] = 0.01 + 0.15 * r;
    atmo._calculatedSkyColor[1] = 0.03 + 0.35 * g;
    atmo._calculatedSkyColor[2] = 0.10 + 0.65 * b;

    // Horizon (Suelo) - Naranja sangre incandescente que corta el horizonte
    atmo._calculatedGroundColor[0] = r * 1.0;
    atmo._calculatedGroundColor[1] = g * 0.40 + 0.05;
    atmo._calculatedGroundColor[2] = b * 0.20 + 0.05;
  }
}