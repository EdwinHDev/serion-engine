/**
 * EditorState.ts - Fuente única de verdad para la selección y estado de la UI.
 * Capa 13.7: UI Fase 2 - USelection Standard.
 */
export class EditorState {
  private static selectedActorIds: Set<number> = new Set();

  /**
   * Cambia la selección actual.
   * @param id ID del actor a seleccionar.
   * @param multiSelect Si es true, añade a la selección; si es false, reemplaza.
   */
  public static selectActor(id: number, multiSelect: boolean = false): void {
    if (!multiSelect) {
      this.selectedActorIds.clear();
    }

    this.selectedActorIds.add(id);
    this.notifySelectionChanged();
  }

  /**
   * Limpia toda la selección actual.
   */
  public static clearSelection(): void {
    if (this.selectedActorIds.size === 0) return;
    this.selectedActorIds.clear();
    this.notifySelectionChanged();
  }

  /**
   * Obtiene la lista de IDs seleccionados.
   */
  public static getSelectedIds(): number[] {
    return Array.from(this.selectedActorIds);
  }

  /**
   * Comprueba si un actor está seleccionado.
   */
  public static isActorSelected(id: number): boolean {
    return this.selectedActorIds.has(id);
  }

  /**
   * Notifica a todos los observadores (paneles) que la selección ha cambiado.
   */
  private static notifySelectionChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('serion:selection-changed', {
        detail: { selectedIds: this.getSelectedIds() }
      }));
    }
  }
}
