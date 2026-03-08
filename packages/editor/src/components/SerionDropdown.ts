/**
 * SerionDropdown Component
 * Reusable dropdown menu for the editor toolbar.
 */
import { MenuManager } from './MenuManager';

export interface MenuItem {
  label?: string;
  action?: () => void;
  shortcut?: string;
  divider?: boolean;
}

export class SerionDropdown extends HTMLElement {
  private _items: MenuItem[] = [];
  private _isOpen: boolean = false;
  private _trigger: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.addEventListener('serion-menu-close', () => this.close());
  }

  set items(value: MenuItem[]) {
    this._items = value;
    this.render();
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

  private handleItemClick(item: MenuItem) {
    if (item.action) item.action();
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
    const left = triggerRect ? triggerRect.left : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: ${top}px;
          left: ${left}px;
          z-index: 10000;
          min-width: 180px;
          background-color: var(--serion-bg-2);
          border: 1px solid var(--serion-border);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          padding: 4px 0;
          border-radius: 4px;
          user-select: none;
        }

        .menu-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          cursor: pointer;
          color: var(--serion-text-main);
          font-size: 11px;
          transition: background-color 0.1s;
        }

        .menu-item:hover {
          background-color: var(--serion-accent);
          color: #fff;
        }

        .shortcut {
          color: var(--serion-text-dim);
          font-size: 10px;
          margin-left: 2rem;
        }

        .divider {
          height: 1px;
          background-color: var(--serion-border);
          margin: 4px 0;
        }
      </style>
      <div class="menu-container">
        ${this._items.map((item, index) => {
      if (item.divider) return `<div class="divider"></div>`;
      return `
            <div class="menu-item" data-index="${index}">
              <span>${item.label}</span>
              ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
            </div>
          `;
    }).join('')}
      </div>
    `;

    this.shadowRoot.querySelectorAll('.menu-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '0');
        this.handleItemClick(this._items[index]);
      });
    });
  }
}
