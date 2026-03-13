import { SWorld } from '../core/SWorld';
import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';

/**
 * SceneBuilder - Encargado de la construcción de escenarios y prototipado.
 * Capa 12.9: Desacoplamiento de Escena (SRP).
 */
export class SceneBuilder {

  /**
   * Construye el escenario base AAA (Blank Canvas).
   * Contiene únicamente los elementos esenciales de iluminación y atmósfera.
   * @param world El mundo donde se instanciarán los actores.
   */
  public static buildShowcase(world: SWorld): void {
    // 1. Entorno Físico (Sol y Atmósfera Reactiva)
    const sunActor = world.spawnActor('Directional Light');
    sunActor.directionalLight = new SDirectionalLightComponent();
    
    // Inclinamos el Sol cerca del horizonte (Z = -0.15) para forzar la dispersión de Rayleigh
    // El color y la intensidad base ahora son orquestados por AtmosphereSystem en la CPU.
    sunActor.directionalLight.setDirection(0.8, 0.2, -0.15);

    const atmosphereActor = world.spawnActor('Sky Atmosphere');
    atmosphereActor.atmosphere = new SAtmosphereComponent();
    atmosphereActor.atmosphere.ambientIntensity = 1.0;
  }
}