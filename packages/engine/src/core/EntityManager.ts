import { Logger } from '../utils/Logger';

/**
 * EntityManager - Gestión de IDs de entidades y reciclaje (Pool Pattern).
 */
export class EntityManager {
  private availableIds: number[] = [];
  private isAvailable: Uint8Array;
  private nextId: number = 0;

  constructor(private readonly maxEntities: number) {
    this.isAvailable = new Uint8Array(maxEntities);
  }

  /**
   * Crea una nueva entidad obteniendo un ID del pool o incrementando el contador.
   */
  public createEntity(): number {
    // 1. Intentar reciclar un ID
    if (this.availableIds.length > 0) {
      const id = this.availableIds.pop()!;
      this.isAvailable[id] = 0;
      return id;
    }

    // 2. Si no hay reciclables, usar el siguiente ID
    if (this.nextId >= this.maxEntities) {
      const msg = `Límite de entidades alcanzado (${this.maxEntities}). No se pueden crear más actores.`;
      Logger.fatal('ENGINE', msg);
      throw new Error(msg);
    }

    return this.nextId++;
  }

  /**
   * Libera un ID para su posterior reciclaje.
   */
  public destroyEntity(id: number): void {
    // O(1) check using availability map
    if (this.isAvailable[id] === 0) {
      this.availableIds.push(id);
      this.isAvailable[id] = 1;
    }
  }

  /**
   * Obtiene la cantidad de IDs que están siendo usados actualmente.
   */
  public getActiveCount(): number {
    return this.nextId - this.availableIds.length;
  }
}
