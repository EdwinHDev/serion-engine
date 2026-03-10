import { SerionEngine } from '../SerionEngine';

/**
 * EngineAPI - Puente de comunicación global entre el Editor y el Motor.
 * ID: SER-10-DETAILS-PANEL | Paso 1.
 */
export class EngineAPI {
  constructor(private readonly engine: SerionEngine) { }

  /**
   * Monta la API en el objeto global y establece los escuchas de eventos.
   */
  public mount(): void {
    if (typeof window !== 'undefined') {
      (window as any).SerionEngineAPI = this;
      window.addEventListener('serion:actor-property-changed', this.handlePropertyChanged.bind(this));
    }
  }

  /**
   * Obtiene un DTO estático del estado actual de un actor.
   */
  public getActorData(id: number): any {
    const actor = this.engine.activeWorld?.getActors().get(id);
    if (!actor) return null;

    const dto: any = {
      id: actor.id,
      transform: {
        position: [actor.x, actor.y, actor.z],
        rotation: [actor.rotationX, actor.rotationY, actor.rotationZ, actor.rotationW],
        scale: [actor.scaleX, actor.scaleY, actor.scaleZ]
      }
    };

    if (actor.material) {
      dto.material = {
        baseColor: Array.from(actor.material.baseColor),
        pbrParams: Array.from(actor.material.pbrParams)
      };
    }

    if (actor.directionalLight) {
      dto.light = {
        color: Array.from(actor.directionalLight.color),
        intensity: actor.directionalLight.intensity,
        direction: Array.from(actor.directionalLight.direction)
      };
    }

    return dto;
  }

  /**
   * Maneja las peticiones de mutación desde la UI.
   */
  private handlePropertyChanged(e: Event): void {
    const detail = (e as CustomEvent).detail;
    if (!detail) return;

    const { id, component, property, value } = detail;
    const actor = this.engine.activeWorld?.getActors().get(id);
    if (!actor) return;

    let modified = false;

    switch (component) {
      case 'transform':
        if (property === 'position') {
          actor.setPosition(value[0], value[1], value[2]);
          modified = true;
        } else if (property === 'rotation') {
          actor.setRotation(value[0], value[1], value[2], value[3]);
          modified = true;
        } else if (property === 'scale') {
          actor.setScale(value[0], value[1], value[2]);
          modified = true;
        }
        break;

      case 'material':
        if (actor.material) {
          if (property === 'baseColor') {
            actor.material.baseColor.set(value);
            modified = true;
          } else if (property === 'pbrParams') {
            actor.material.pbrParams.set(value);
            modified = true;
          }
        }
        break;

      case 'light':
        if (actor.directionalLight) {
          if (property === 'color') {
            actor.directionalLight.setColor(value[0], value[1], value[2]);
            modified = true;
          } else if (property === 'intensity') {
            actor.directionalLight.setIntensity(value);
            modified = true;
          } else if (property === 'direction') {
            actor.directionalLight.setDirection(value[0], value[1], value[2]);
            modified = true;
          }
        }
        break;
    }

    if (modified) {
      this.engine.activeWorld?.markSceneGraphDirty();
    }
  }
}
