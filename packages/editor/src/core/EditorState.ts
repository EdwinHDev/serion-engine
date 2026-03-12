/**
 * EditorState.ts - Fuente única de verdad para la selección y estado de la UI.
 * Capa 13.7: UI Fase 2 - USelection Standard.
 */

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'world' | 'local';

export class EditorState {
  private static selectedActorIds: Set<number> = new Set();

  // --- ESTADO DE INTERACCIÓN ---
  public static isNavigating: boolean = false;

  // --- ESTADO DE TRANSFORMACIÓN ---
  public static transformMode: TransformMode = 'translate';
  public static transformSpace: TransformSpace = 'world';

  // --- ESTADO DE SNAPPING (Imanes) ---
  public static snapTranslationEnabled: boolean = false;
  public static snapTranslationValue: number = 10.0; // 10 cm

  public static snapRotationEnabled: boolean = false;
  public static snapRotationValue: number = 15.0; // 15 grados

  public static snapScaleEnabled: boolean = false;
  public static snapScaleValue: number = 0.25; // 25%

  // --- SETTERS REACTIVOS ---
  public static setTransformMode(mode: TransformMode): void {
    if (this.transformMode === mode) return;
    this.transformMode = mode;
    window.dispatchEvent(new CustomEvent('serion:transform-mode-changed', { detail: { mode } }));
  }

  public static setTransformSpace(space: TransformSpace): void {
    if (this.transformSpace === space) return;
    this.transformSpace = space;
    window.dispatchEvent(new CustomEvent('serion:transform-space-changed', { detail: { space } }));
  }

  public static toggleSnap(type: 'translation' | 'rotation' | 'scale'): void {
    if (type === 'translation') this.snapTranslationEnabled = !this.snapTranslationEnabled;
    if (type === 'rotation') this.snapRotationEnabled = !this.snapRotationEnabled;
    if (type === 'scale') this.snapScaleEnabled = !this.snapScaleEnabled;
    window.dispatchEvent(new CustomEvent('serion:transform-snap-changed'));
  }

  public static setSnapValue(type: 'translation' | 'rotation' | 'scale', value: number): void {
    if (type === 'translation') this.snapTranslationValue = value;
    if (type === 'rotation') this.snapRotationValue = value;
    if (type === 'scale') this.snapScaleValue = value;
    window.dispatchEvent(new CustomEvent('serion:transform-snap-changed'));
  }

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
