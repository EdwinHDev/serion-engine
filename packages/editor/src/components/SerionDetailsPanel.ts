/**
 * SerionDetailsPanel - Interfaz de edición de propiedades para Actores.
 * ID: SER-10-DETAILS-PANEL | Paso 2.
 */
export class SerionDetailsPanel extends HTMLElement {
  private currentActorId: number | null = null;
  private selectionHandler = (e: Event) => this.onSelectionChanged(e as CustomEvent);

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('serion:selection-changed', this.selectionHandler);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener('serion:selection-changed', this.selectionHandler);
  }

  private onSelectionChanged(e: CustomEvent): void {
    const selectedIds = e.detail.selectedIds as number[];
    if (selectedIds.length === 1) {
      this.currentActorId = selectedIds[0];
    } else {
      this.currentActorId = null;
    }
    this.render();
  }

  private dispatchPropertyChange(component: string, property: string, value: any): void {
    if (this.currentActorId === null) return;

    window.dispatchEvent(new CustomEvent('serion:actor-property-changed', {
      detail: {
        id: this.currentActorId,
        component,
        property,
        value
      }
    }));
  }

  private render() {
    if (!this.shadowRoot) return;

    if (this.currentActorId === null) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; padding: 20px; color: var(--serion-text-dim); font-size: 11px; font-style: italic; opacity: 0.5; }
        </style>
        Select a single object to view details.
      `;
      return;
    }

    const api = (window as any).SerionEngineAPI;
    const actorData = api ? api.getActorData(this.currentActorId) : null;

    if (!actorData) {
      this.shadowRoot.innerHTML = `<div style="padding: 20px;">Error: Engine API not found or Actor data unavailable.</div>`;
      return;
    }

    const pos = actorData.transform.position;
    const sca = actorData.transform.scale;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--serion-text-main);
          font-family: 'Inter', sans-serif;
          user-select: none;
        }

        .category {
          border-bottom: 1px solid var(--serion-border);
        }

        .category-header {
          background: var(--serion-bg-2);
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--serion-text-dim);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .category-content {
          padding: 12px;
        }

        .property-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
          gap: 12px;
        }

        .property-label {
          width: 80px;
          font-size: 11px;
          color: var(--serion-text-dim);
        }

        .vector-input {
          flex: 1;
          display: flex;
          gap: 4px;
        }

        .axis-group {
          flex: 1;
          display: flex;
          align-items: center;
          background: var(--serion-bg-2);
          border-radius: 2px;
          overflow: hidden;
          border: 1px solid transparent;
        }

        .axis-group:focus-within {
          border-color: var(--serion-accent);
        }

        .axis-label {
          width: 14px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 900;
          color: #fff;
        }

        .axis-x { background: #e74c3c; } /* Rojo Unreal */
        .axis-y { background: #2ecc71; } /* Verde Unreal */
        .axis-z { background: #3498db; } /* Azul Unreal */

        input {
          width: 100%;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 11px;
          padding: 4px;
          outline: none;
          min-width: 0;
        }

        input::-webkit-inner-spin-button, 
        input::-webkit-outer-spin-button { 
          -webkit-appearance: none; margin: 0; 
        }

        .actor-id-tag {
          font-size: 9px;
          background: var(--serion-accent);
          color: #fff;
          padding: 2px 4px;
          border-radius: 2px;
          margin-left: auto;
        }
      </style>

      <div class="category">
        <div class="category-header">
          <span>▼</span> Transform
          <span class="actor-id-tag">ID: ${actorData.id}</span>
        </div>
        <div class="category-content">
          <div class="property-row">
            <div class="property-label">Location</div>
            <div class="vector-input">
              <div class="axis-group">
                <div class="axis-label axis-x">X</div>
                <input type="number" step="0.1" id="pos-x" value="${pos[0].toFixed(2)}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-y">Y</div>
                <input type="number" step="0.1" id="pos-y" value="${pos[1].toFixed(2)}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-z">Z</div>
                <input type="number" step="0.1" id="pos-z" value="${pos[2].toFixed(2)}">
              </div>
            </div>
          </div>

          <div class="property-row">
            <div class="property-label">Scale</div>
            <div class="vector-input">
              <div class="axis-group">
                <div class="axis-label axis-x">X</div>
                <input type="number" step="0.1" id="sca-x" value="${sca[0].toFixed(2)}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-y">Y</div>
                <input type="number" step="0.1" id="sca-y" value="${sca[1].toFixed(2)}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-z">Z</div>
                <input type="number" step="0.1" id="sca-z" value="${sca[2].toFixed(2)}">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupInputEvents();
  }

  private setupInputEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    const inputs = ['pos-x', 'pos-y', 'pos-z', 'sca-x', 'sca-y', 'sca-z'];

    inputs.forEach(id => {
      const input = root.getElementById(id) as HTMLInputElement;
      if (input) {
        input.addEventListener('input', () => {
          const type = id.startsWith('pos') ? 'position' : 'scale';
          const prefix = id.startsWith('pos') ? 'pos' : 'sca';

          const x = parseFloat((root.getElementById(`${prefix}-x`) as HTMLInputElement).value) || 0;
          const y = parseFloat((root.getElementById(`${prefix}-y`) as HTMLInputElement).value) || 0;
          const z = parseFloat((root.getElementById(`${prefix}-z`) as HTMLInputElement).value) || 0;

          this.dispatchPropertyChange('transform', type, [x, y, z]);
        });
      }
    });
  }
}

customElements.define('serion-details-panel', SerionDetailsPanel);
