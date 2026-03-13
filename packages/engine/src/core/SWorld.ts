import { EntityManager } from './EntityManager';
import { SActor } from './SActor';
import { SLevel } from './SLevel';
import { Logger } from '../utils/Logger';
import { AtmosphereSystem } from '../lighting/AtmosphereSystem';

/**
 * SWorld - Contenedor Lógico de la Simulación.
 * Centraliza la gestión de actores y la ejecución de sistemas.
 */
export class SWorld {
  private entityManager: EntityManager;
  public persistentLevel: SLevel;

  private sceneGraphDirty = false;
  private renderSequence: SActor[] = [];

  /**
   * @param engine Referencia al motor (Capa 0/1) para el TransformPool.
   * @param maxEntities Límite de actores para este mundo.
   */
  constructor(
    public readonly engine: any,
    maxEntities: number = 10000
  ) {
    this.entityManager = new EntityManager(maxEntities);
    this.persistentLevel = new SLevel("PersistentLevel");
  }

  /**
   * Crea un nuevo actor en este mundo.
   */
  public spawnActor(name?: string): SActor {
    const id = this.entityManager.createEntity();
    const actor = new SActor(id, this);
    actor.name = name || `Actor_${id}`;

    // El actor se registra en el nivel persistente
    this.persistentLevel.addActor(actor);

    this.renderSequence.push(actor);
    this.markSceneGraphDirty();

    // Emitir evento granular para la UI (Desacoplamiento)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('serion:actor-spawned', {
        detail: { id: actor.id, name: actor.name, parentId: actor.parentId }
      }));
    }

    return actor;
  }

  /**
   * Elimina un actor del mundo y recicla su ID.
   * Implementa destrucción en cascada real.
   */
  public destroyActor(actor: SActor): void {
    const idList: number[] = [actor.id];

    // Buscar hijos recursivamente para destrucción en cascada
    const findChildren = (parentId: number) => {
      for (const other of this.persistentLevel.actors.values()) {
        if (other.parentId === parentId) {
          idList.push(other.id);
          findChildren(other.id);
        }
      }
    };
    findChildren(actor.id);

    // Destruir todos los actores identificados (de mayor a menor ID para evitar problemas de referencia si fuera necesario)
    for (const id of idList) {
      const a = this.persistentLevel.actors.get(id);
      if (!a) continue;

      this.entityManager.destroyEntity(id);
      this.persistentLevel.removeActor(id);

      const idx = this.renderSequence.findIndex(x => x.id === id);
      if (idx !== -1) this.renderSequence.splice(idx, 1);
    }

    this.markSceneGraphDirty();

    // Emitir evento granular para la UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('serion:actor-destroyed', {
        detail: { id: actor.id }
      }));
    }
  }

  /**
   * Método helper para que la UI obtenga todos los actores del nivel activo.
   */
  public getAllActors(): SActor[] {
    return this.persistentLevel.getActors();
  }

  public markSceneGraphDirty(): void {
    this.sceneGraphDirty = true;
  }

  /**
   * Reordena renderSequence mediante Ordenamiento Topológico (DFS).
   * Garantiza que los padres siempre estén antes que los hijos para la iteración lineal.
   */
  private sortSceneGraph(): void {
    const visited = new Set<number>();
    const sorted: SActor[] = [];

    const visit = (actor: SActor) => {
      if (visited.has(actor.id)) return;

      // Si tiene padre, visitar al padre primero (si existe en el mundo)
      if (actor.parentId !== null) {
        const parent = this.persistentLevel.actors.get(actor.parentId);
        if (parent) visit(parent);
      }

      visited.add(actor.id);
      sorted.push(actor);
    };

    // Comenzar el recorrido para todos los actores actuales
    for (const actor of this.persistentLevel.actors.values()) {
      visit(actor);
    }

    this.renderSequence = sorted;
    Logger.info('WORLD', `Grafo de Escena ordenado topológicamente (${this.renderSequence.length} actores).`);
  }

  /**
   * Bucle lógico del mundo.
   * Procesa transformaciones jerárquicas de forma lineal y eficiente.
   */
  public tick(_deltaTime: number): void {
    if (this.sceneGraphDirty) {
      this.sortSceneGraph();
      this.sceneGraphDirty = false;
    }

    // --- ACTUALIZACIÓN DE MATRICES (LINEAL / DOD / ZERO-GC) ---
    const pool = this.engine.transformPool;
    const count = this.renderSequence.length;

    let mainSun: SActor | null = null;
    let atmoActor: SActor | null = null;

    for (let i = 0; i < count; i++) {
      const actor = this.renderSequence[i];

      // 1. Actualizar Matriz Global
      if (actor.parentId !== null) {
        const parentGlobalMatrix = pool.getModelMatrix(actor.parentId);
        pool.updateActorGlobalMatrix(actor.id, parentGlobalMatrix);
      } else {
        pool.updateActorGlobalMatrix(actor.id);
      }

      // 2. Sincronización de Componentes (DOD)
      if (actor.directionalLight) {
        // Extraer el Vector Forward (+X) directamente de la matriz final del mundo
        const m = pool.getModelMatrix(actor.id);
        actor.directionalLight.setDirection(m[0], m[1], m[2]);
        mainSun = actor;
      }
      if (actor.atmosphere) {
        atmoActor = actor;
      }
    }

    // 3. Simulación Atmosférica en Tiempo Real
    if (mainSun?.directionalLight && atmoActor?.atmosphere) {
      AtmosphereSystem.updateTransmittance(mainSun.directionalLight, atmoActor.atmosphere);
    }

    // Lógica adicional de sistemas (Físicas, I.A, etc) vendría aquí.
  }

  public getActors(): Map<number, SActor> {
    return this.persistentLevel.actors;
  }

  public shiftOrigin(offsetX: number, offsetY: number, offsetZ: number): void {
    for (const actor of this.persistentLevel.actors.values()) {
      // ESTÁNDAR AAA: Los hijos NO se desplazan. Su posición es local a su padre.
      // El padre, al ser desplazado globalmente, arrastrará a sus hijos.
      if (actor.parentId !== null) continue;

      actor.setPosition(
        actor.x - offsetX,
        actor.y - offsetY,
        actor.z - offsetZ
      );
    }
    this.markSceneGraphDirty();
    Logger.info('WORLD', `Origin Shift: [${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}, ${offsetZ.toFixed(2)}]`);
  }

  public getEntityManager(): EntityManager {
    return this.entityManager;
  }
}
