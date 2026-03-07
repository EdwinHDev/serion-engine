/**
 * SerionAssetItem Component
 * Reusable visual representation of an engine asset.
 */

export type AssetType = 'Folder' | 'Mesh' | 'Texture' | 'Material' | 'Shader';

export class SerionAssetItem extends HTMLElement {
  private _type: AssetType = 'Mesh';
  private _label: string = 'NewAsset';
  private _selected: boolean = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['type', 'label', 'selected'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    if (name === 'type') this._type = newValue as AssetType;
    if (name === 'label') this._label = newValue;
    if (name === 'selected') this._selected = newValue !== null;

    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private getIcon(): string {
    switch (this._type) {
      case 'Folder': return '📁';
      case 'Mesh': return '📦';
      case 'Texture': return '🖼️';
      case 'Material': return '🎨';
      case 'Shader': return '⚡';
      default: return '📄';
    }
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 80px;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
          transition: background-color 0.1s;
          border: 1px solid transparent;
        }

        :host(:hover) {
          background-color: rgba(255, 255, 255, 0.05);
        }

        :host([selected]) {
          background-color: var(--serion-asset-selected);
          border-color: var(--serion-asset-selected-border);
        }

        .icon {
          font-size: 32px;
          margin-bottom: 4px;
          filter: drop-shadow(0 4px 4px rgba(0,0,0,0.5));
        }

        .label {
          font-size: 10px;
          color: var(--serion-text-main);
          text-align: center;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :host([selected]) .label {
          color: #fff;
          font-weight: bold;
        }
      </style>
      <div class="icon">${this.getIcon()}</div>
      <div class="label" title="${this._label}">${this._label}</div>
    `;
  }
}
