import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';

/**
 * AtmosphereSystem - Orquestador de la simulación atmosférica en CPU.
 * Capa 13.9.1: Transmitancia Física Dinámica y Corrección Diurna.
 */
export class AtmosphereSystem {
  public static updateTransmittance(sun: SDirectionalLightComponent, atmo: SAtmosphereComponent): void {
    const sunDir = sun.direction;
    const elevation = Math.max(0.001, -sunDir[2]);

    // 1. Transmitancia Física (La absorción del aire y color del Sol)
    const r = 1.0;
    const g = Math.pow(elevation, 0.45);
    const b = Math.max(0.0, Math.pow(elevation, 0.75) - 0.05);

    const extinction = Math.pow(elevation, 0.25);
    const baseLux = sun.baseIntensity;

    sun.intensity = baseLux * extinction;
    sun.setColor(r, g, b);

    // 2. Colores del Cielo (Zenith) - Azul naval que cae a violeta
    atmo._calculatedSkyColor[0] = 0.01 + 0.15 * r;
    atmo._calculatedSkyColor[1] = 0.03 + 0.35 * g;
    atmo._calculatedSkyColor[2] = 0.10 + 0.65 * b;

    // 3. Colores del Horizonte (Ground / Haze)
    // Base de día: Azul muy claro / Cian (Bruma atmosférica limpia)
    atmo._calculatedGroundColor[0] = 0.10 + 0.30 * r;
    atmo._calculatedGroundColor[1] = 0.20 + 0.50 * g;
    atmo._calculatedGroundColor[2] = 0.30 + 0.60 * b;

    // Factor de Atardecer: Solo despierta cuando el sol cae (elevation < 0.3)
    const sunsetBleed = Math.max(0.0, 1.0 - elevation * 3.3);
    
    // Inyectamos el naranja sangre SOLO al atardecer, restando verde y azul
    atmo._calculatedGroundColor[0] += sunsetBleed * 0.8;
    atmo._calculatedGroundColor[1] -= sunsetBleed * 0.2;
    atmo._calculatedGroundColor[2] -= sunsetBleed * 0.5;
  }
}