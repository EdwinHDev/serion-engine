import { EditorState, TransformMode, TransformSpace } from '../core/EditorState';

export class SerionViewportOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.setupListeners();
    this.syncUI(); // Sincronización inicial
  }

  private setupListeners(): void {
    // Escuchar a la UI (Clics)
    this.shadowRoot!.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as TransformMode;
        if (mode) EditorState.setTransformMode(mode);
      });
    });

    this.shadowRoot!.querySelectorAll('.space-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const space = (e.currentTarget as HTMLElement).dataset.space as TransformSpace;
        if (space) EditorState.setTransformSpace(space);
      });
    });

    this.shadowRoot!.querySelectorAll('.snap-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const snap = (e.currentTarget as HTMLElement).dataset.snap as 'translation' | 'rotation' | 'scale';
        if (snap) EditorState.toggleSnap(snap);
      });
    });

    // Escuchar al Cerebro (Motor/Teclado)
    window.addEventListener('serion:transform-mode-changed', () => this.syncUI());
    window.addEventListener('serion:transform-space-changed', () => this.syncUI());
    window.addEventListener('serion:transform-snap-changed', () => this.syncUI());
  }

  private syncUI(): void {
    const root = this.shadowRoot!;
    
    // Sincronizar Herramientas
    root.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const activeTool = root.querySelector(`.tool-btn[data-mode="${EditorState.transformMode}"]`);
    if (activeTool) activeTool.classList.add('active');

    // Sincronizar Espacio
    root.querySelectorAll('.space-btn').forEach(btn => btn.classList.remove('active'));
    const activeSpace = root.querySelector(`.space-btn[data-space="${EditorState.transformSpace}"]`);
    if (activeSpace) activeSpace.classList.add('active');

    // Sincronizar Imanes
    root.querySelector('.snap-btn[data-snap="translation"]')?.classList.toggle('active', EditorState.snapTranslationEnabled);
    root.querySelector('.snap-btn[data-snap="rotation"]')?.classList.toggle('active', EditorState.snapRotationEnabled);
    root.querySelector('.snap-btn[data-snap="scale"]')?.classList.toggle('active', EditorState.snapScaleEnabled);
  }

  private render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 10px;
          pointer-events: none; /* Deja pasar los clics al canvas por defecto */
          z-index: 10;
        }
        .toolbar-group {
          display: flex;
          background: rgba(22, 22, 22, 0.85); /* --serion-bg-1 translúcido */
          border: 1px solid var(--serion-border, #2B2B2B);
          border-radius: 4px;
          padding: 2px;
          pointer-events: auto; /* Reactiva los clics en los botones */
          backdrop-filter: blur(4px);
        }
        button {
          background: transparent;
          border: none;
          color: #888;
          width: 32px;
          height: 32px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.2s;
        }
        button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #DDD;
        }
        button.active {
          background: rgba(0, 112, 255, 0.2); /* Fondo sutil con accent */
          color: var(--serion-accent, #0070FF);
        }
        .divider {
          width: 1px;
          background: var(--serion-border, #2B2B2B);
          margin: 4px;
        }
      </style>

      <div class="toolbar-group">
        <button class="tool-btn" data-mode="select" title="Select (Q)">🖱️</button>
        <button class="tool-btn" data-mode="translate" title="Translate (W)">✥</button>
        <button class="tool-btn" data-mode="rotate" title="Rotate (E)">↻</button>
        <button class="tool-btn" data-mode="scale" title="Scale (R)">⤢</button>
      </div>

      <div class="toolbar-group">
        <button class="space-btn" data-space="world" title="World Space">🌐</button>
        <button class="space-btn" data-space="local" title="Local Space">📦</button>
      </div>

      <div class="toolbar-group">
        <button class="snap-btn" data-snap="translation" title="Snap to Grid">▦</button>
        <button class="snap-btn" data-snap="rotation" title="Snap Rotation">∠</button>
        <button class="snap-btn" data-snap="scale" title="Snap Scale">◱</button>
      </div>
    `;
  }
}
