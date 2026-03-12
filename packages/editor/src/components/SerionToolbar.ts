/**
 * SerionToolbar Component
 * Refactored to use the standalone SerionModePanel.
 */
import { MenuItem } from './SerionDropdown';
import { MenuManager } from './MenuManager';

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

        /* QUICK ADD STYLES */
        .toolbar-left {
            display: flex;
            align-items: center;
            height: 100%;
        }

        .add-container { position: relative; display: flex; align-items: center; }

        .btn-add {
          background: var(--serion-accent);
          border: none;
          border-radius: 4px;
          color: white;
          padding: 4px 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          font-size: 13px;
          transition: background 0.1s;
        }

        .btn-add:hover { background: #0080FF; }
        .btn-add:active { background: #0050BB; }

        .chevron { opacity: 0.7; margin-top: 2px; }

        /* Dropdown UE5 Style */
        .quick-add-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          width: 200px;
          background: var(--serion-bg-2);
          border: 1px solid var(--serion-border);
          border-radius: 4px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.6);
          display: none;
          flex-direction: column;
          padding: 6px 0;
          z-index: 9999;
        }

        .quick-add-menu.visible { display: flex; }

        .section-header {
          font-size: 10px;
          font-weight: 800;
          color: #777;
          padding: 6px 14px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .menu-item {
          padding: 6px 14px;
          font-size: 13px;
          color: #ccc;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .menu-item:hover {
          background: var(--serion-accent);
          color: white;
        }

        .menu-divider {
          height: 1px;
          background: var(--serion-border);
          margin: 4px 0;
        }

        .spacer-v {
          width: 1px;
          height: 16px;
          background: var(--serion-border);
          margin: 0 12px;
          opacity: 0.5;
        }
      </style>
      
      <div class="logo">SERION<span>ENGINE</span></div>

      <div class="toolbar-left">
        <div class="add-container">
          <button class="btn-add" id="btn-quick-add" title="Add instances to the world">
            <span class="icon-cube-plus">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  <circle cx="18" cy="18" r="5" fill="var(--serion-accent)" stroke="none"></circle>
                  <line x1="18" y1="16" x2="18" y2="20" stroke="white" stroke-width="2"></line>
                  <line x1="16" y1="18" x2="20" y2="18" stroke="white" stroke-width="2"></line>
                </svg>
            </span>
            <span class="label">Add</span>
            <span class="chevron">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M6 9l6 6 6-6"></path>
                </svg>
            </span>
          </button>

          <div class="quick-add-menu" id="quick-add-dropdown">
            <div class="menu-section">
              <div class="section-header">Basic</div>
              <div class="menu-item" data-action="spawn" data-type="empty">Empty Actor</div>
              <div class="menu-item" data-action="spawn" data-type="character">Character</div>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-section">
              <div class="section-header">Lights</div>
              <div class="menu-item" data-action="spawn" data-type="dir-light">Directional Light</div>
              <div class="menu-item" data-action="spawn" data-type="point-light">Point Light</div>
              <div class="menu-item" data-action="spawn" data-type="sky-light">Sky Light</div>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-section">
              <div class="section-header">Shapes</div>
              <div class="menu-item" data-action="spawn" data-type="cube">Cube</div>
              <div class="menu-item" data-action="spawn" data-type="sphere">Sphere</div>
              <div class="menu-item" data-action="spawn" data-type="cylinder">Cylinder</div>
              <div class="menu-item" data-action="spawn" data-type="plane">Plane</div>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-section">
              <div class="section-header">Visual Effects</div>
              <div class="menu-item" data-action="spawn" data-type="niagara">Niagara System</div>
              <div class="menu-item" data-action="spawn" data-type="volumetric">Volumetric Cloud</div>
            </div>
          </div>
        </div>
        <div class="spacer-v"></div>
      </div>
      
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

    // Professional Hover-to-Switch logic
    const navItems = ['file', 'edit', 'window', 'tools', 'build', 'help'];
    navItems.forEach(id => {
      this.shadowRoot?.getElementById(`menu-${id}`)?.addEventListener('mouseenter', (e) => {
        if (MenuManager.getInstance().hasActiveMenu()) {
          this.handleMenuClick(e as MouseEvent, id);
        }
      });
    });

    this.shadowRoot.getElementById('btn-select-mode')?.addEventListener('click', (e) => this.openModePanel(e as MouseEvent));

    this.setupQuickAdd();
  }

  private setupQuickAdd() {
    const btn = this.shadowRoot?.getElementById('btn-quick-add');
    const menu = this.shadowRoot?.getElementById('quick-add-dropdown');

    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu?.classList.toggle('visible');
    });

    // Cerrar al hacer clic fuera
    window.addEventListener('click', () => {
      menu?.classList.remove('visible');
    });

    // Placeholder para acciones futuras
    menu?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      const type = target.getAttribute('data-type');

      if (action === 'spawn' && type) {
        console.log(`[Serion History] Preparado para registrar Spawn de: ${type}`);
        // No hacemos nada todavía, siguiendo las reglas del Arquitecto.
      }
    });
  }
}
