/**
 * SerionContentBrowser Component
 * Bottom panel for asset management.
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
        }

        .header {
          background-color: var(--serion-bg-2);
          padding: 6px 12px;
          font-weight: 600;
          font-size: 11px;
          display: flex;
          gap: 1rem;
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
      <div class="browser-area">
        <div class="file-grid">
          ${this.assets.map(asset => `
            <serion-asset-item 
              type="${asset.type}" 
              label="${asset.label}">
            </serion-asset-item>
          `).join('')}
        </div>
      </div>
    `;

    // Selection logic
    this.shadowRoot.querySelectorAll('serion-asset-item').forEach(item => {
      item.addEventListener('click', () => {
        this.shadowRoot?.querySelectorAll('serion-asset-item').forEach(i => i.removeAttribute('selected'));
        item.setAttribute('selected', '');
      });
    });
  }
}
