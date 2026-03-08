/**
 * SerionModePanel Component
 * Standalone floating panel for selection modes.
 * Integrates with MenuManager for outside-click closing.
 */
import { MenuManager } from './MenuManager';

export class SerionModePanel extends HTMLElement {
  private _isOpen: boolean = false;
  private _trigger: HTMLElement | null = null;
  private _currentMode: string = 'Select';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.addEventListener('serion-menu-close', () => this.close());
  }

  public set currentMode(value: string) {
    this._currentMode = value;
    if (this._isOpen) this.render();
  }

  public get currentMode(): string {
    return this._currentMode;
  }

  public open(trigger: HTMLElement) {
    this._trigger = trigger;
    this._isOpen = true;
    MenuManager.getInstance().setActiveMenu(this);
    this.render();
  }

  public close() {
    this._isOpen = false;
    this._trigger = null;
    this.render();
  }

  private selectMode(modeName: string) {
    this._currentMode = modeName;
    this.dispatchEvent(new CustomEvent('serion-mode-select', {
      detail: { mode: modeName },
      bubbles: true,
      composed: true
    }));
    MenuManager.getInstance().closeActiveMenu();
  }

  private render() {
    if (!this.shadowRoot) return;

    if (!this._isOpen) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const triggerRect = this._trigger?.getBoundingClientRect();
    const top = triggerRect ? triggerRect.bottom : 0;
    const right = triggerRect ? window.innerWidth - triggerRect.right : 0;

    const modes = [
      { name: 'Select', icon: '↖️' },
      { name: 'Landscape', icon: '⛰️' },
      { name: 'Foliage', icon: '🌿' },
      { name: 'Modeling', icon: '🧱' }
    ];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: ${top + 4}px;
          right: ${right}px;
          z-index: 10000;
          background-color: var(--serion-bg-2);
          border: 1px solid var(--serion-border);
          border-radius: 4px;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(2, 60px);
          gap: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
          user-select: none;
        }

        .mode-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 9px;
          color: var(--serion-text-dim);
          transition: background 0.1s, color 0.1s;
        }

        .mode-item:hover {
          background: var(--serion-bg-1);
          color: #fff;
        }

        .mode-item.active {
          background: var(--serion-accent);
          color: #fff;
        }

        .mode-icon {
          font-size: 18px;
        }
      </style>
      
      ${modes.map(mode => `
        <div class="mode-item ${mode.name === this._currentMode ? 'active' : ''}" data-mode="${mode.name}">
          <span class="mode-icon">${mode.icon}</span>
          <span>${mode.name}</span>
        </div>
      `).join('')}
    `;

    this.shadowRoot.querySelectorAll('.mode-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectMode((el as HTMLElement).dataset.mode || 'Select');
      });
    });
  }
}
