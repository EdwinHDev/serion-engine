import { SWorld } from '../core/SWorld';
import { SStaticMeshComponent } from '../components/SStaticMeshComponent';
import { SMaterialComponent } from '../components/SMaterialComponent';
import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';

/**
 * SceneBuilder - Encargado de la construcción de escenarios y prototipado.
 * Capa 12.9: Desacoplamiento de Escena (SRP).
 */
export class SceneBuilder {

  /**
   * Construye la escena de prueba técnica (Showcase) con las primitivas PBR.
   * @param world El mundo donde se instanciarán los actores.
   */
  public static buildShowcase(world: SWorld): void {
    // 1. Suelo de concreto (Pase de sombras receptor)
    const floor = world.spawnActor();
    floor.setScale(5000, 5000, 10);
    floor.setPosition(0, 0, 1);
    floor.staticMesh = new SStaticMeshComponent('Primitive_Plane');
    floor.material = new SMaterialComponent();
    floor.material.setColor(0.6, 0.6, 0.6);
    floor.material.setPBR(0.0, 0.7);

    // 2. Galería de Primitivas PBR para validación de sombras y materiales
    this.spawnShowcaseActor(world, 'Primitive_Cube', -400, 0, 150, [1.0, 0.8, 0.0], 1.0, 0.1);    // Oro
    this.spawnShowcaseActor(world, 'Primitive_Sphere', -200, 0, 150, [1.0, 0.1, 0.1], 0.0, 0.2);    // Plástico
    this.spawnShowcaseActor(world, 'Primitive_Cylinder', 0, 0, 150, [0.9, 0.9, 0.9], 1.0, 0.4);      // Aluminio
    this.spawnShowcaseActor(world, 'Primitive_Cone', 200, 0, 150, [0.1, 0.8, 0.2], 0.0, 0.9);    // Goma
    this.spawnShowcaseActor(world, 'Primitive_Capsule', 400, 0, 150, [1.0, 0.4, 0.2], 1.0, 0.15);   // Cobre

    // 3. Actores de Entorno (Sin Geometría)
    const sunActor = world.spawnActor();
    sunActor.directionalLight = new SDirectionalLightComponent();
    sunActor.directionalLight.setColor(1.0, 0.98, 0.95);
    sunActor.directionalLight.setIntensity(120000.0);
    sunActor.directionalLight.setDirection(0.5, 0.5, -1.0);

    const atmosphereActor = world.spawnActor();
    atmosphereActor.atmosphere = new SAtmosphereComponent();
    atmosphereActor.atmosphere.setSkyColor(0.15, 0.35, 0.75);
    atmosphereActor.atmosphere.setGroundColor(0.05, 0.05, 0.05);
    atmosphereActor.atmosphere.setAmbientIntensity(1.0);
  }

  /**
   * Helper interno para instanciar actores de la galería.
   */
  private static spawnShowcaseActor(
    world: SWorld,
    meshId: string,
    x: number, y: number, z: number,
    color: number[],
    met: number, rough: number
  ): void {
    const actor = world.spawnActor();
    actor.setPosition(x, y, z);
    actor.setScale(100, 100, 100);
    actor.staticMesh = new SStaticMeshComponent(meshId);
    actor.material = new SMaterialComponent();
    actor.material.setColor(color[0], color[1], color[2]);
    actor.material.setPBR(met, rough);
  }
}
