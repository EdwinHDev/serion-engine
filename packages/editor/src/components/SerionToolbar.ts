/**
 * SerionToolbar Component
 * Refactored to use the standalone SerionModePanel.
 */
import { MenuItem } from './SerionDropdown';

export class SerionToolbar extends HTMLElement {
  private activeMode: string = 'Select Mode';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();

    // Listen for mode selection events from the global mode panel
    window.addEventListener('serion-mode-select', (e: any) => {
      this.activeMode = `${e.detail.mode} Mode`;
      this.render();
    });
  }

  private handleMenuClick(e: MouseEvent, menuId: string) {
    const trigger = e.currentTarget as HTMLElement;
    const dropdown = document.querySelector('serion-dropdown') as any;

    if (!dropdown) return;

    let items: MenuItem[] = [];
    if (menuId === 'file') {
      items = [
        { label: 'New Level', shortcut: 'Ctrl+N', action: () => console.log('New Level') },
        { label: 'Open Level...', shortcut: 'Ctrl+O', action: () => console.log('Open Level') },
        { divider: true },
        { label: 'Save Current', shortcut: 'Ctrl+S', action: () => console.log('Save') },
        { label: 'Save All', shortcut: 'Ctrl+Shift+S', action: () => console.log('Save All') }
      ];
    } else if (menuId === 'edit') {
      items = [
        { label: 'Undo', shortcut: 'Ctrl+Z' },
        { label: 'Redo', shortcut: 'Ctrl+Y' },
        { divider: true },
        { label: 'Cut', shortcut: 'Ctrl+X' },
        { label: 'Copy', shortcut: 'Ctrl+C' },
        { label: 'Paste', shortcut: 'Ctrl+V' }
      ];
    } else if (menuId === 'window') {
      items = [
        { label: 'Editor Viewports' },
        { label: 'Outliner' },
        { label: 'Details' },
        { label: 'Content Browser' },
        { divider: true },
        { label: 'World Settings' },
        { label: 'Project Settings' }
      ];
    } else if (menuId === 'tools') {
      items = [
        { label: 'Material Editor' },
        { label: 'Niagara Editor' },
        { label: 'Blueprint Debugger' },
        { divider: true },
        { label: 'Profiler' },
        { label: 'Command Console', shortcut: '~' }
      ];
    } else if (menuId === 'build') {
      items = [
        { label: 'Build All Levels' },
        { divider: true },
        { label: 'Build Lighting' },
        { label: 'Build Reflection Captures' },
        { label: 'Build Geometry' },
        { label: 'Build Navigation' }
      ];
    } else if (menuId === 'help') {
      items = [
        { label: 'Documentation' },
        { label: 'Tutorials' },
        { label: 'Forum' },
        { divider: true },
        { label: 'About Serion Engine' }
      ];
    }

    dropdown.items = items;
    dropdown.open(trigger);
  }

  private openModePanel(e: MouseEvent) {
    const trigger = e.currentTarget as HTMLElement;
    const panel = document.querySelector('serion-mode-panel') as any;
    if (panel) {
      panel.open(trigger);
    }
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          background-color: var(--serion-bg-1);
          border-bottom: 1px solid var(--serion-border);
          padding: 0 0.5rem;
          gap: 1rem;
          color: var(--serion-text-main);
          user-select: none;
          height: var(--serion-toolbar-height);
        }

        .logo {
          font-weight: 800;
          color: #fff;
          letter-spacing: 1.5px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 1rem;
        }

        .logo span {
          color: var(--serion-accent);
        }

        .nav-items {
          display: flex;
          height: 100%;
        }

        .nav-item {
          display: flex;
          align-items: center;
          padding: 0 12px;
          cursor: pointer;
          color: var(--serion-text-main);
          font-size: 12px;
          transition: background-color 0.15s, color 0.15s;
          height: 100%;
        }

        .nav-item:hover, .nav-item.active {
          background-color: var(--serion-bg-2);
          color: #fff;
        }

        .action-button {
          background-color: var(--serion-accent);
          color: white;
          border: none;
          padding: 6px 16px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          margin-left: auto;
          margin-right: 1rem;
          text-transform: uppercase;
          transition: background-color 0.2s;
        }

        .action-button:hover {
          background-color: var(--serion-accent-hover);
        }
      </style>
      
      <div class="logo">SERION<span>ENGINE</span></div>
      
      <div class="nav-items">
        <div class="nav-item" id="menu-file">File</div>
        <div class="nav-item" id="menu-edit">Edit</div>
        <div class="nav-item" id="menu-window">Window</div>
        <div class="nav-item" id="menu-tools">Tools</div>
        <div class="nav-item" id="menu-build">Build</div>
        <div class="nav-item" id="menu-help">Help</div>
      </div>

      <button class="action-button" id="btn-select-mode">${this.activeMode}</button>
    `;

    this.shadowRoot.getElementById('menu-file')?.addEventListener('click', (e) => this.handleMenuClick(e as MouseEvent, 'file'));
    this.shadowRoot.getElementById('menu-edit')?.addEventListener('click', (e) => this.handleMenuClick(e as MouseEvent, 'edit'));
    this.shadowRoot.getElementById('menu-window')?.addEventListener('click', (e) => this.handleMenuClick(e as MouseEvent, 'window'));
    this.shadowRoot.getElementById('menu-tools')?.addEventListener('click', (e) => this.handleMenuClick(e as MouseEvent, 'tools'));
    this.shadowRoot.getElementById('menu-build')?.addEventListener('click', (e) => this.handleMenuClick(e as MouseEvent, 'build'));
    this.shadowRoot.getElementById('menu-help')?.addEventListener('click', (e) => this.handleMenuClick(e as MouseEvent, 'help'));
    this.shadowRoot.getElementById('btn-select-mode')?.addEventListener('click', (e) => this.openModePanel(e as MouseEvent));
  }
}
