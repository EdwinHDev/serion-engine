import { EditorState } from '../core/EditorState';
import './SerionDetailsPanel';
import './SerionDetailsPanel';

/**
 * SerionSidebar - Virtualized Tree View Outliner & Details Panel.
 * Handles 100,000+ actors with zero DOM lag while maintaining UI flexibility.
 */
export class SerionSidebar extends HTMLElement {
  private readonly ROW_HEIGHT = 28;
  private readonly POOL_SIZE = 45;

  private rawData: Map<number, { id: number, name: string, parentId: number | null, isExpanded: boolean }> = new Map();
  private flattenedList: Array<{ id: number, name: string, depth: number, hasChildren: boolean, isExpanded: boolean }> = [];
  private collapsedPanels: Set<string> = new Set();

  private viewport: HTMLElement | null = null;
  private ghost: HTMLElement | null = null;
  private itemPool: HTMLElement[] = [];

  // Handlers
  private onSpawned = (e: any) => this.addItem(e.detail);
  private onDestroyed = (e: any) => this.removeItem(e.detail.id);
  private onSelection = () => this.syncSelection();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.updateFlattenedList();
    this.renderVirtualScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('serion:actor-spawned', this.onSpawned);
    window.removeEventListener('serion:actor-destroyed', this.onDestroyed);
    window.removeEventListener('serion:selection-changed', this.onSelection);
  }

  private setupListeners() {
    window.addEventListener('serion:actor-spawned', this.onSpawned);
    window.addEventListener('serion:actor-destroyed', this.onDestroyed);
    window.addEventListener('serion:selection-changed', this.onSelection);

    // El listener de scroll se añade dinámicamente en el render() o tras él
  }

  private togglePanel(panelId: string) {
    if (this.collapsedPanels.has(panelId)) {
      this.collapsedPanels.delete(panelId);
    } else {
      this.collapsedPanels.add(panelId);
    }
    this.render();
    this.updateFlattenedList();
    this.renderVirtualScroll();
  }

  private addItem(data: { id: number, name: string, parentId: number | null }) {
    this.rawData.set(data.id, { ...data, isExpanded: true });
    this.updateFlattenedList();
    this.renderVirtualScroll();
  }

  private removeItem(id: number) {
    this.rawData.delete(id);
    this.updateFlattenedList();
    this.renderVirtualScroll();
  }

  private updateFlattenedList() {
    const list: typeof this.flattenedList = [];

    // 1. OPTIMIZACIÓN O(N): Agrupar todos los hijos por su parentId en una sola pasada.
    // Esto evita recorrer el rawData (100,000 items) múltiples veces.
    const childrenMap = new Map<number | null, any[]>();

    for (const actor of this.rawData.values()) {
      let siblings = childrenMap.get(actor.parentId);
      if (!siblings) {
        siblings = [];
        childrenMap.set(actor.parentId, siblings);
      }
      siblings.push(actor);
    }

    // 2. Recorrido recursivo ultra-rápido usando el mapa pre-calculado
    const traverse = (parentId: number | null, depth: number) => {
      const children = childrenMap.get(parentId);
      if (!children) return;

      for (const child of children) {
        // Un actor tiene hijos si existe como "padre" en nuestro mapa
        const nodeChildren = childrenMap.get(child.id);
        const canExpand = nodeChildren ? nodeChildren.length > 0 : false;

        list.push({
          id: child.id,
          name: child.name,
          depth,
          hasChildren: canExpand,
          isExpanded: child.isExpanded
        });

        // Si está expandido y tiene hijos, continuamos la recursividad
        if (child.isExpanded && canExpand) {
          traverse(child.id, depth + 1);
        }
      }
    };

    // Iniciar desde la raíz (los que no tienen padre)
    traverse(null, 0);
    this.flattenedList = list;

    // Actualizar la altura del contenedor fantasma para la barra de scroll
    if (this.ghost) {
      this.ghost.style.height = `${this.flattenedList.length * this.ROW_HEIGHT}px`;
    }
  }

  private renderVirtualScroll() {
    if (!this.viewport || !this.itemPool.length) return;
    if (this.collapsedPanels.has('outliner')) return;

    const scrollTop = this.viewport.scrollTop;
    const startIndex = Math.floor(scrollTop / this.ROW_HEIGHT);

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const itemIndex = startIndex + i;
      const element = this.itemPool[i];
      const data = this.flattenedList[itemIndex];

      if (data) {
        element.style.display = 'flex';
        element.style.transform = `translateY(${itemIndex * this.ROW_HEIGHT}px)`;
        element.dataset.id = data.id.toString();

        const arrow = data.hasChildren ? (data.isExpanded ? '▼' : '▶') : '';
        element.innerHTML = `
          <div class="indent" style="width: ${data.depth * 16}px"></div>
          <span class="toggle ${data.hasChildren ? 'visible' : ''}">${arrow}</span>
          <span class="icon">💠</span>
          <span class="name">${data.name}</span>
        `;

        element.classList.toggle('selected', EditorState.isActorSelected(data.id));
      } else {
        element.style.display = 'none';
      }
    }
  }

  private syncSelection() {
    this.itemPool.forEach(el => {
      const id = parseInt(el.dataset.id || '-1');
      el.classList.toggle('selected', EditorState.isActorSelected(id));
    });
  }

  private toggleExpand(id: number) {
    const actor = this.rawData.get(id);
    if (actor) {
      actor.isExpanded = !actor.isExpanded;
      this.updateFlattenedList();
      this.renderVirtualScroll();
    }
  }

  private render() {
    if (!this.shadowRoot) return;

    const isOutlinerCollapsed = this.collapsedPanels.has('outliner');
    const isDetailsCollapsed = this.collapsedPanels.has('details');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          background-color: var(--serion-bg-1);
          border-left: 1px solid var(--serion-border);
          height: 100%;
          width: 100%;
          min-width: 200px;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        .panel { display: flex; flex-direction: column; min-height: 0; }
        .panel.expanded { flex: 1; }
        .panel.collapsed { flex: 0 0 auto; }
        .panel:not(:last-child) { border-bottom: 1px solid var(--serion-border); }

        .header {
          background-color: var(--serion-bg-2);
          padding: 10px 14px;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--serion-text-main);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
          transition: background-color 0.15s;
        }

        .header:hover { background-color: #2e2e2e; color: #fff; }

        .arrow { font-size: 8px; opacity: 0.5; transition: transform 0.2s; }
        .arrow.collapsed { transform: rotate(-90deg); }

        /* Virtual Outliner Styles */
        .viewport {
          flex: 1;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--serion-bg-1);
        }

        .ghost { position: absolute; top: 0; left: 0; right: 0; pointer-events: none; }

        .outliner-item {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 28px;
          display: flex;
          align-items: center;
          padding: 0 8px;
          font-size: 12px;
          color: var(--serion-text-dim);
          cursor: pointer;
          user-select: none;
          border-left: 3px solid transparent;
        }

        .outliner-item:hover { background: rgba(255, 255, 255, 0.03); color: var(--serion-text-main); }
        .outliner-item.selected { background: rgba(59, 130, 246, 0.2); color: #fff; border-left-color: var(--serion-accent); }

        .toggle { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 8px; opacity: 0.4; visibility: hidden; }
        .toggle.visible { visibility: visible; }
        .toggle:hover { opacity: 1; color: var(--serion-accent); }
        .icon { font-size: 10px; margin-right: 6px; opacity: 0.6; }
        .name { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }

        .content { flex: 1; padding: 0; overflow-y: auto; color: var(--serion-text-dim); background-color: var(--serion-bg-1); }
        .panel.collapsed .content, .panel.collapsed .viewport { display: none; }

        .empty-state { font-style: italic; font-size: 11px; opacity: 0.4; }

        .viewport::-webkit-scrollbar { width: 6px; }
        .viewport::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      </style>
      
      <div class="panel ${isOutlinerCollapsed ? 'collapsed' : 'expanded'}">
        <div class="header" id="outliner-header">
          Outliner
          <span class="arrow ${isOutlinerCollapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="viewport" id="viewport">
          <div class="ghost" id="ghost"></div>
        </div>
      </div>

      <div class="panel ${isDetailsCollapsed ? 'collapsed' : 'expanded'}">
        <div class="header" id="details-header">
          Details
          <span class="arrow ${isDetailsCollapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <serion-details-panel></serion-details-panel>
      </div>
    `;

    this.viewport = this.shadowRoot.getElementById('viewport');
    this.ghost = this.shadowRoot.getElementById('ghost');

    this.shadowRoot.getElementById('outliner-header')?.addEventListener('click', () => this.togglePanel('outliner'));
    this.shadowRoot.getElementById('details-header')?.addEventListener('click', () => this.togglePanel('details'));

    if (this.viewport && !isOutlinerCollapsed) {
      this.viewport.addEventListener('scroll', () => this.renderVirtualScroll());

      // Init Pool
      this.itemPool = [];
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const div = document.createElement('div');
        div.className = 'outliner-item';
        div.addEventListener('click', (e) => {
          const id = parseInt(div.dataset.id || '-1');
          EditorState.selectActor(id, e.ctrlKey || e.metaKey);
        });
        div.addEventListener('mousedown', (e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('toggle')) {
            e.stopPropagation();
            this.toggleExpand(parseInt(div.dataset.id || '-1'));
          }
        });
        this.viewport.appendChild(div);
        this.itemPool.push(div);
      }
    }
  }
}

customElements.define('serion-sidebar', SerionSidebar);
