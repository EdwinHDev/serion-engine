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
    // 1. Suelo de concreto (Pase de sombras receptor temporal)
    const floor = world.spawnActor('Floor');
    floor.setScale(5000, 5000, 10);
    floor.setPosition(0, 0, 1);
    floor.staticMesh = new SStaticMeshComponent('Primitive_Plane');
    floor.material = new SMaterialComponent();
    floor.material.setColor(0.6, 0.6, 0.6);
    floor.material.setPBR(0.0, 0.7);

    // 2. Galería de Primitivas PBR para validación de sombras y materiales
    this.spawnShowcaseActor(world, 'Primitive_Cube', -400, 0, 150, [1.0, 0.8, 0.0], 1.0, 0.1, 'Cube');      // Oro
    this.spawnShowcaseActor(world, 'Primitive_Sphere', -200, 0, 150, [1.0, 0.1, 0.1], 0.0, 0.2, 'Sphere');    // Plástico
    this.spawnShowcaseActor(world, 'Primitive_Cylinder', 0, 0, 150, [0.9, 0.9, 0.9], 1.0, 0.4, 'Cylinder');     // Aluminio
    this.spawnShowcaseActor(world, 'Primitive_Cone', 200, 0, 150, [0.1, 0.8, 0.2], 0.0, 0.9, 'Cone');       // Goma
    this.spawnShowcaseActor(world, 'Primitive_Capsule', 400, 0, 150, [1.0, 0.4, 0.2], 1.0, 0.15, 'Capsule');   // Cobre

    // 3. Entorno Físico (Sol y Atmósfera Reactiva)
    const sunActor = world.spawnActor('DirectionalLight (Sun)');
    sunActor.directionalLight = new SDirectionalLightComponent();
    // Inclinamos el Sol cerca del horizonte (Z = -0.15) para forzar la dispersión de Rayleigh
    // El color y la intensidad base ahora son orquestados por AtmosphereSystem en la CPU.
    sunActor.directionalLight.setDirection(0.8, 0.2, -0.15);

    const atmosphereActor = world.spawnActor('Atmosphere');
    atmosphereActor.atmosphere = new SAtmosphereComponent();
    atmosphereActor.atmosphere.ambientIntensity = 1.0;
    // Eliminados los colores hardcodeados. El RHI ahora dibuja el SkyShader proceduralmente.
  }

  /**
   * Helper interno para instanciar actores de la galería.
   */
  private static spawnShowcaseActor(
    world: SWorld,
    meshId: string,
    x: number, y: number, z: number,
    color: number[],
    met: number, rough: number,
    name?: string
  ): void {
    const actor = world.spawnActor(name);
    actor.setPosition(x, y, z);
    actor.setScale(100, 100, 100);
    actor.staticMesh = new SStaticMeshComponent(meshId);
    actor.material = new SMaterialComponent();
    actor.material.setColor(color[0], color[1], color[2]);
    actor.material.setPBR(met, rough);
  }
}