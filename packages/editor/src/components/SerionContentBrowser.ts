/**
 * SerionContentBrowser Component
 * Refined asset browser with persistent selection logic.
 */

export class SerionContentBrowser extends HTMLElement {
  private assets = [
    { type: 'Folder', label: 'Models' },
    { type: 'Folder', label: 'Materials' },
    { type: 'Mesh', label: 'SM_HeroCharacter' },
    { type: 'Mesh', label: 'SM_Environment_Rock' },
    { type: 'Texture', label: 'T_Character_Albedo' },
    { type: 'Material', label: 'M_Master_Opaque' },
    { type: 'Shader', label: 'S_Water_GPUSim' }
  ];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private handleAssetClick(e: MouseEvent, index: number) {
    // Prevent event from bubbling to browser-area
    e.stopPropagation();

    const items = this.shadowRoot?.querySelectorAll('serion-asset-item');
    items?.forEach((item, i) => {
      if (i === index) {
        item.setAttribute('selected', '');
      } else {
        item.removeAttribute('selected');
      }
    });
  }

  private handleAreaClick() {
    // In many professional engines, clicking the empty space does NOT deselect.
    // We keep the selection persistent as requested.
    console.log("Clicked background area - selection preserved.");
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          background-color: var(--serion-bg-1);
          border-top: 1px solid var(--serion-border);
          height: 100%;
          overflow: hidden;
        }

        .header {
          background-color: var(--serion-bg-2);
          padding: 6px 12px;
          font-weight: 600;
          font-size: 11px;
          display: flex;
          gap: 1rem;
          user-select: none;
        }

        .tab {
          color: var(--serion-text-main);
          border-bottom: 2px solid var(--serion-accent);
          padding: 4px 8px;
        }

        .browser-area {
          flex: 1;
          display: flex;
          padding: 1rem;
          overflow-y: auto;
          background-color: var(--serion-bg-1);
        }

        .file-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
          width: 100%;
          align-content: start;
        }
      </style>
      <div class="header">
        <div class="tab">Content Browser</div>
      </div>
      <div class="browser-area" id="browser-area">
        <div class="file-grid">
          ${this.assets.map((asset, index) => `
            <serion-asset-item 
              class="asset-item"
              data-index="${index}"
              type="${asset.type}" 
              label="${asset.label}">
            </serion-asset-item>
          `).join('')}
        </div>
      </div>
    `;

    const area = this.shadowRoot.getElementById('browser-area');
    area?.addEventListener('click', () => this.handleAreaClick());

    const items = this.shadowRoot.querySelectorAll('.asset-item');
    items.forEach((item, index) => {
      item.addEventListener('click', (e) => this.handleAssetClick(e as MouseEvent, index));
    });
  }
}
