import { EntityManager } from './EntityManager';
import { SActor } from './SActor';
import { Logger } from '../utils/Logger';

/**
 * SWorld - Contenedor Lógico de la Simulación.
 * Centraliza la gestión de actores y la ejecución de sistemas.
 */
export class SWorld {
  private entityManager: EntityManager;
  private actors: Map<number, SActor> = new Map();

  /**
   * @param engine Referencia al motor (Capa 0/1) para el TransformPool.
   * @param maxEntities Límite de actores para este mundo.
   */
  constructor(
    private readonly engine: any,
    maxEntities: number
  ) {
    this.entityManager = new EntityManager(maxEntities);
  }

  /**
   * Crea un nuevo actor en este mundo.
   */
  public spawnActor(): SActor {
    const id = this.entityManager.createEntity();
    const actor = new SActor(id, this.engine);
    // this.actors.set(id, actor);
    this.actors.set(actor.id, actor);

    // Emitir evento granular para la UI (Desacoplamiento)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('serion:actor-spawned', {
        detail: { id: actor.id, name: `Actor_${actor.id}` }
      }));
    }

    return actor;
  }

  /**
   * Elimina un actor del mundo y recicla su ID.
   */
  public destroyActor(actor: SActor): void {
    const id = actor.id;
    this.entityManager.destroyEntity(id);
    this.actors.delete(id);

    // Emitir evento granular para la UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('serion:actor-destroyed', {
        detail: { id: id }
      }));
    }
  }

  /**
   * Bucle lógico del mundo.
   * Orquestador de todos los sistemas de simulación.
   */
  public tick(_deltaTime: number): void {
    // --- LÓGICA DE SIMULACIÓN ---
    // TODO: Iterar sobre sistemas ECS, físicas y grafos de comportamiento.
    // [RENDIMIENTO]: No iteramos sobre this.actors directamente por razones de caché CPU.
    // Los sistemas deben iterar sobre los TypedArrays del engine.transformPool.
  }

  /**
   * Obtiene el EntityManager del mundo.
   */
  public getActors(): Map<number, SActor> {
    return this.actors;
  }

  /**
   * Desplaza el origen del mundo para mantener la precisión de punto flotante (Rebase).
   * @param offsetX Desplazamiento en X.
   * @param offsetY Desplazamiento en Y.
   * @param offsetZ Desplazamiento en Z.
   */
  public shiftOrigin(offsetX: number, offsetY: number, offsetZ: number): void {
    for (const actor of this.actors.values()) {
      actor.setPosition(
        actor.x - offsetX,
        actor.y - offsetY,
        actor.z - offsetZ
      );
    }
    Logger.info('WORLD', `Origin Shift ejecutado. Offset: [${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}, ${offsetZ.toFixed(2)}]`);
  }

  public getEntityManager(): EntityManager {
    return this.entityManager;
  }
}
