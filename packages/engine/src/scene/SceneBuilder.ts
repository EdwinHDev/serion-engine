import { SerionEngine } from '../SerionEngine';
import { SCamera } from '../camera/SCamera';
import { FreeCameraController } from '../camera/FreeCameraController';
import { SDirectionalLightComponent } from '../components/SDirectionalLightComponent';
import { SAtmosphereComponent } from '../components/SAtmosphereComponent';


/**
 * SceneBuilder - Encargado de la construcción de escenarios y prototipado.
 * Capa 12.10: Limpieza y SRP (SceneBuilder Refactor).
 */
export class SceneBuilder {
  /**
   * Construye el escenario base AAA (Blank Canvas).
   * @param engine Referencia al motor para acceder al World y CameraManager.
   * @returns El controlador de cámara para que el bucle principal lo actualice.
   */
  public static buildShowcase(engine: SerionEngine): FreeCameraController {
    const world = engine.activeWorld;

    // 1. Editor Camera
    const cameraActor = world.spawnActor('Editor Camera');
    // Posición Isométrica 3/4
    cameraActor.setPosition(367, -350, 120);

    const mainCamera = new SCamera(cameraActor);
    mainCamera.pitch = -10.0;
    mainCamera.yaw = 135.0;

    engine.cameraManager.setActiveCamera(mainCamera);
    const cameraController = new FreeCameraController(mainCamera);

    // 2. Entorno Físico (Sol - 10:00 AM)
    const sunActor = world.spawnActor('Directional Light');
    sunActor.directionalLight = new SDirectionalLightComponent();

    // CORRECCIÓN AAA: Rotamos el Actor usando el nuevo método Euler.
    // El SWorld se encargará de extraer el vector Forward de la matriz resultante.
    // Pitch: -50 (Elevación matutina), Yaw: 45 (Diagonal)
    sunActor.setRotationEuler(50, 45, 0);

    // 3. Atmósfera Reactiva
    const atmosphereActor = world.spawnActor('Sky Atmosphere');
    atmosphereActor.atmosphere = new SAtmosphereComponent();
    atmosphereActor.atmosphere.ambientIntensity = 1.0;

    atmosphereActor.atmosphere.ambientIntensity = 1.0;

    return cameraController;
  }
}