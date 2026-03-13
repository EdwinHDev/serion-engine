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
    
    // Simulación de las 10:00 AM (Elevación media-alta desde el Este)
    // Pitch -50, Yaw 45 -> Vector: (0.454, 0.454, -0.766)
    // El AtmosphereSystem orquestará el color basado en esta dirección.
    sunActor.directionalLight.setDirection(0.454, 0.454, -0.766);

    const atmosphereActor = world.spawnActor('Sky Atmosphere');
    atmosphereActor.atmosphere = new SAtmosphereComponent();
    atmosphereActor.atmosphere.ambientIntensity = 1.0;
  }
}