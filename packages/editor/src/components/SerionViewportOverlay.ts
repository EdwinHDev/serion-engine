import { editorState, TransformMode } from '../core/EditorState';

export class SerionViewportOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.setupListeners();
    this.syncUI();
  }

  private setupListeners(): void {
    const root = this.shadowRoot!;

    // 1. Herramientas de Transformación
    root.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as TransformMode;
        if (mode) editorState.setTransformMode(mode);
      });
    });

    // 2. Toggle de Espacio (World / Local)
    const spaceBtn = root.querySelector('.space-toggle-btn') as HTMLElement;
    spaceBtn.addEventListener('click', () => {
      const newSpace = editorState.transformSpace === 'world' ? 'local' : 'world';
      editorState.setTransformSpace(newSpace);
    });

    // 3. Toggles de Imanes (Snapping)
    root.querySelectorAll('.snap-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const snap = (e.currentTarget as HTMLElement).dataset.snap as 'translation' | 'rotation' | 'scale';
        if (snap) editorState.toggleSnap(snap);
      });
    });

    // 4. Dropdowns de Valores (Selects)
    root.querySelectorAll('.snap-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const type = target.dataset.snapType as 'translation' | 'rotation' | 'scale';
        editorState.setSnapValue(type, parseFloat(target.value));
      });
    });

    // Escuchar eventos globales del Cerebro
    window.addEventListener('serion:transform-mode-changed', () => this.syncUI());
    window.addEventListener('serion:transform-space-changed', () => this.syncUI());
    window.addEventListener('serion:transform-snap-changed', () => this.syncUI());
  }

  private syncUI(): void {
    const root = this.shadowRoot!;
    
    // Herramientas
    root.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    root.querySelector(`.tool-btn[data-mode="${editorState.transformMode}"]`)?.classList.add('active');

    // Espacio Toggle
    const spaceBtn = root.querySelector('.space-toggle-btn') as HTMLElement;
    spaceBtn.textContent = editorState.transformSpace === 'world' ? '🌐' : '📦';
    spaceBtn.title = editorState.transformSpace === 'world' ? 'World Space' : 'Local Space';

    // Imanes Activos
    root.querySelector('.snap-btn[data-snap="translation"]')?.classList.toggle('active', editorState.snapTranslationEnabled);
    root.querySelector('.snap-btn[data-snap="rotation"]')?.classList.toggle('active', editorState.snapRotationEnabled);
    root.querySelector('.snap-btn[data-snap="scale"]')?.classList.toggle('active', editorState.snapScaleEnabled);

    // Valores de Selects
    (root.querySelector('.snap-select[data-snap-type="translation"]') as HTMLSelectElement).value = editorState.snapTranslationValue.toString();
    (root.querySelector('.snap-select[data-snap-type="rotation"]') as HTMLSelectElement).value = editorState.snapRotationValue.toString();
    (root.querySelector('.snap-select[data-snap-type="scale"]') as HTMLSelectElement).value = editorState.snapScaleValue.toString();
  }

  private render(): void {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 12px;
          pointer-events: none;
          z-index: 10;
          font-family: sans-serif;
        }
        .toolbar-group {
          display: flex;
          align-items: center;
          background: rgba(22, 22, 22, 0.85);
          border: 1px solid var(--serion-border, #2B2B2B);
          border-radius: 4px;
          padding: 2px;
          pointer-events: auto;
          backdrop-filter: blur(4px);
        }
        button {
          background: transparent;
          border: none;
          color: #888;
          width: 30px;
          height: 30px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: background 0.1s, color 0.1s;
        }
        button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #DDD;
        }
        button.active {
          background: rgba(0, 112, 255, 0.2);
          color: var(--serion-accent, #0070FF);
        }
        .divider {
          width: 1px;
          height: 20px;
          background: var(--serion-border, #2B2B2B);
          margin: 0 4px;
        }
        select.snap-select {
          background: transparent;
          color: #888;
          border: none;
          outline: none;
          cursor: pointer;
          font-size: 11px;
          padding: 0 4px 0 0;
          margin-right: 4px;
          appearance: auto;
        }
        select.snap-select:hover { color: #DDD; }
        option { background: var(--serion-bg-2, #262626); color: #DDD; }
      </style>

      <div class="toolbar-group">
        <button class="tool-btn" data-mode="select" title="Select (Q)">🖱️</button>
        <button class="tool-btn" data-mode="translate" title="Translate (W)">✥</button>
        <button class="tool-btn" data-mode="rotate" title="Rotate (E)">↻</button>
        <button class="tool-btn" data-mode="scale" title="Scale (R)">⤢</button>
      </div>

      <div class="toolbar-group">
        <button class="space-toggle-btn" title="Toggle Space"></button>
      </div>

      <div class="toolbar-group">
        <button class="snap-btn" data-snap="translation" title="Snap to Grid">▦</button>
        <div class="divider"></div>
        <select class="snap-select" data-snap-type="translation">
          <option value="1">1</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="500">500</option>
        </select>
      </div>

      <div class="toolbar-group">
        <button class="snap-btn" data-snap="rotation" title="Snap Rotation">∠</button>
        <div class="divider"></div>
        <select class="snap-select" data-snap-type="rotation">
          <option value="5">5°</option>
          <option value="10">10°</option>
          <option value="15">15°</option>
          <option value="30">30°</option>
          <option value="45">45°</option>
          <option value="90">90°</option>
          <option value="120">120°</option>
        </select>
      </div>

      <div class="toolbar-group">
        <button class="snap-btn" data-snap="scale" title="Snap Scale">◱</button>
        <div class="divider"></div>
        <select class="snap-select" data-snap-type="scale">
          <option value="0.0625">0.0625</option>
          <option value="0.125">0.125</option>
          <option value="0.25">0.25</option>
          <option value="0.5">0.5</option>
          <option value="1">1.0</option>
        </select>
      </div>
    `;
  }
}
