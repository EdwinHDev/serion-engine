import { SWorld, SProject, SStaticMeshComponent, SerionEngine } from '@serion/engine';

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

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Intercepta las órdenes de creación de la UI
    window.addEventListener('serion:spawn-actor', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.handleSpawnActor(customEvent.detail.type);
    });
  }

  public initializeDefaultSession(engine: SerionEngine): void {
    // Crea el proyecto base
    this.currentProject = new SProject("My Serion Game");
    
    // Crea el mundo inicial inyectando el motor REAL
    const defaultWorld = new SWorld(engine); 
    this.setActiveWorld(defaultWorld);
    
    console.log(`[Serion Editor] Session initialized. Project: ${this.currentProject.name}`);
  }

  public setActiveWorld(world: SWorld): void {
    this.activeWorld = world;
    this.selectedActorIds = []; // Limpia selección al cambiar de mundo
    window.dispatchEvent(new CustomEvent('serion:world-changed'));
  }

  private handleSpawnActor(type: string) {
    if (!this.activeWorld) {
      console.warn("[Serion Editor] Cannot spawn actor: No active world.");
      return;
    }

    // Mapeo amigable para el nombre del actor
    const nameMap: Record<string, string> = {
      'cube': 'Cube',
      'sphere': 'Sphere',
      'plane': 'Plane',
      'empty': 'Empty Actor',
      'dir-light': 'Directional Light',
      'point-light': 'Point Light'
    };

    const actorName = nameMap[type] || `New ${type}`;
    
    // 1. Instanciar en el mundo vivo
    const newActor = this.activeWorld.spawnActor(actorName);
    
    // 2. Asignar componentes según el tipo
    if (type === 'cube' || type === 'sphere' || type === 'plane') {
        const meshId = `Primitive_${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const mesh = this.activeWorld.engine.geometryRegistry.getMesh(meshId);
        if (mesh) {
            newActor.staticMesh = new SStaticMeshComponent(meshId);
        }
    } else if (type === 'dir-light') {
        // En el futuro esto añadiría un SLightComponent
        // Por ahora spawnActor ya crea el actor base
    }
    
    // 3. Seleccionar automáticamente el nuevo actor
    this.selectActor(newActor.id, false);
    
    console.log(`[Serion Editor] Spawned: ${actorName} (ID: ${newActor.id}) in Level: ${this.activeWorld.persistentLevel.name}`);
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
