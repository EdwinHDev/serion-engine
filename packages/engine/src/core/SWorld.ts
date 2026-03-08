import { EntityManager } from './EntityManager';
import { SActor } from './SActor';

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
    this.actors.set(id, actor);
    return actor;
  }

  /**
   * Elimina un actor del mundo y recicla su ID.
   */
  public destroyActor(actor: SActor): void {
    this.entityManager.destroyEntity(actor.id);
    this.actors.delete(actor.id);
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
  public getEntityManager(): EntityManager {
    return this.entityManager;
  }
}
