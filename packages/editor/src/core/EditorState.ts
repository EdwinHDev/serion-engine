import { SWorld, SProject } from '@serion/engine';

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'world' | 'local';

export class EditorState {
  public currentProject: SProject | null = null;
  public activeWorld: SWorld | null = null;
  public selectedActorIds: number[] = [];

  // --- ESTADO DE INTERACCIÓN ---
  public isNavigating: boolean = false;

  // --- ESTADO DE TRANSFORMACIÓN ---
  public transformMode: TransformMode = 'translate';
  public transformSpace: TransformSpace = 'world';

  // --- ESTADO DE SNAPPING (Imanes) ---
  public snapTranslationEnabled: boolean = false;
  public snapTranslationValue: number = 10.0; // 10 cm

  public snapRotationEnabled: boolean = false;
  public snapRotationValue: number = 15.0; // 15 grados

  public snapScaleEnabled: boolean = false;
  public snapScaleValue: number = 0.25; // 25%

  public initializeDefaultSession(): void {
    // Crea el proyecto base
    this.currentProject = new SProject("My Serion Game");
    
    // Crea el mundo inicial (que internamente crea su PersistentLevel)
    // En un entorno real, pasaríamos la referencia del motor aquí
    const defaultWorld = new SWorld(null); 
    this.setActiveWorld(defaultWorld);
    
    console.log(`[Serion Editor] Session initialized. Project: ${this.currentProject.name}`);
  }

  public setActiveWorld(world: SWorld): void {
    this.activeWorld = world;
    this.selectedActorIds = []; // Limpia selección al cambiar de mundo
    window.dispatchEvent(new CustomEvent('serion:world-changed'));
  }

  // --- SETTERS REACTIVOS ---
  public setTransformMode(mode: TransformMode): void {
    if (this.transformMode === mode) return;
    this.transformMode = mode;
    window.dispatchEvent(new CustomEvent('serion:transform-mode-changed', { detail: { mode } }));
  }

  public setTransformSpace(space: TransformSpace): void {
    if (this.transformSpace === space) return;
    this.transformSpace = space;
    window.dispatchEvent(new CustomEvent('serion:transform-space-changed', { detail: { space } }));
  }

  public toggleSnap(type: 'translation' | 'rotation' | 'scale'): void {
    if (type === 'translation') this.snapTranslationEnabled = !this.snapTranslationEnabled;
    if (type === 'rotation') this.snapRotationEnabled = !this.snapRotationEnabled;
    if (type === 'scale') this.snapScaleEnabled = !this.snapScaleEnabled;
    window.dispatchEvent(new CustomEvent('serion:transform-snap-changed'));
  }

  public setSnapValue(type: 'translation' | 'rotation' | 'scale', value: number): void {
    if (type === 'translation') this.snapTranslationValue = value;
    if (type === 'rotation') this.snapRotationValue = value;
    if (type === 'scale') this.snapScaleValue = value;
    window.dispatchEvent(new CustomEvent('serion:transform-snap-changed'));
  }

  public selectActor(id: number, multiSelect: boolean = false): void {
    if (!multiSelect) {
      this.selectedActorIds = [];
    }

    if (!this.selectedActorIds.includes(id)) {
      this.selectedActorIds.push(id);
    }
    this.notifySelectionChanged();
  }

  public clearSelection(): void {
    if (this.selectedActorIds.length === 0) return;
    this.selectedActorIds = [];
    this.notifySelectionChanged();
  }

  public getSelectedIds(): number[] {
    return this.selectedActorIds;
  }

  public isActorSelected(id: number): boolean {
    return this.selectedActorIds.includes(id);
  }

  private notifySelectionChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('serion:selection-changed', {
        detail: { selectedIds: this.getSelectedIds() }
      }));
    }
  }
}

export const editorState = new EditorState();
// Inicialización diferida si es necesario, o inmediata aquí
editorState.initializeDefaultSession();
