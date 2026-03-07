/**
 * SerionEditorShell Component
 * Master Layout Orchestrator using CSS Grid and Pointer Capture for robust resizing.
 */

export class SerionEditorShell extends HTMLElement {
  private isResizingSidebar = false;
  private isResizingFooter = false;
  private sidebarWidth = 350;
  private footerHeight = 250;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.initResizing();
  }

  private initResizing() {
    const root = this.shadowRoot;
    if (!root) return;

    const sidebarSplitter = root.querySelector('.sidebar-splitter') as HTMLElement;
    const footerSplitter = root.querySelector('.footer-splitter') as HTMLElement;
    const overlay = root.querySelector('.resize-overlay') as HTMLElement;

    // Sidebar Resizing
    sidebarSplitter.addEventListener('pointerdown', (e) => {
      this.isResizingSidebar = true;
      sidebarSplitter.setPointerCapture(e.pointerId);
      overlay.style.display = 'block';
      overlay.style.cursor = 'col-resize';
      e.preventDefault();
    });

    sidebarSplitter.addEventListener('pointermove', (e) => {
      if (!this.isResizingSidebar) return;

      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 200 && newWidth <= 800) {
        this.sidebarWidth = newWidth;
        this.updateCSSVariables();
      }
    });

    sidebarSplitter.addEventListener('pointerup', (e) => {
      this.isResizingSidebar = false;
      sidebarSplitter.releasePointerCapture(e.pointerId);
      overlay.style.display = 'none';
      overlay.style.cursor = 'default';
    });

    // Footer Resizing
    footerSplitter.addEventListener('pointerdown', (e) => {
      this.isResizingFooter = true;
      footerSplitter.setPointerCapture(e.pointerId);
      overlay.style.display = 'block';
      overlay.style.cursor = 'row-resize';
      e.preventDefault();
    });

    footerSplitter.addEventListener('pointermove', (e) => {
      if (!this.isResizingFooter) return;

      const newHeight = window.innerHeight - e.clientY - 24; // 24 is statusbar height
      if (newHeight >= 100 && newHeight <= 600) {
        this.footerHeight = newHeight;
        this.updateCSSVariables();
      }
    });

    footerSplitter.addEventListener('pointerup', (e) => {
      this.isResizingFooter = false;
      footerSplitter.releasePointerCapture(e.pointerId);
      overlay.style.display = 'none';
      overlay.style.cursor = 'default';
    });
  }

  private updateCSSVariables() {
    this.style.setProperty('--sidebar-width', `${this.sidebarWidth}px`);
    this.style.setProperty('--footer-height', `${this.footerHeight}px`);
  }

  private render() {
    if (!this.shadowRoot) return;

    // Set initial variables
    this.updateCSSVariables();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --sidebar-width: 350px;
          --footer-height: 250px;
          display: block;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }

        .shell-container {
          display: grid;
          grid-template-areas:
            "toolbar toolbar"
            "main-area sidebar"
            "footer sidebar"
            "statusbar statusbar";
          grid-template-rows: var(--serion-toolbar-height) 1fr var(--footer-height) var(--serion-statusbar-height);
          grid-template-columns: 1fr var(--sidebar-width);
          height: 100%;
          width: 100%;
          background-color: var(--serion-bg-0);
          position: relative;
        }

        serion-toolbar { grid-area: toolbar; }
        serion-viewport { grid-area: main-area; }
        serion-sidebar { grid-area: sidebar; }
        serion-content-browser { grid-area: footer; }
        serion-status-bar { grid-area: statusbar; }

        .splitter {
          position: absolute;
          background: transparent;
          z-index: 1000;
          transition: background 0.2s;
          touch-action: none;
        }

        .splitter:hover, .splitter:active {
          background: var(--serion-accent);
        }

        .sidebar-splitter {
          top: var(--serion-toolbar-height);
          bottom: var(--serion-statusbar-height);
          right: calc(var(--sidebar-width) - 2px);
          width: 4px;
          cursor: col-resize;
        }

        .footer-splitter {
          bottom: calc(var(--serion-statusbar-height) + var(--footer-height) - 2px);
          left: 0;
          right: var(--sidebar-width);
          height: 4px;
          cursor: row-resize;
        }

        /* Global Resize Overlay */
        .resize-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          background: transparent;
        }
      </style>
      
      <div class="resize-overlay"></div>
      <div class="shell-container">
        <serion-toolbar></serion-toolbar>
        <serion-viewport></serion-viewport>
        <serion-sidebar></serion-sidebar>
        <serion-content-browser></serion-content-browser>
        <serion-status-bar></serion-status-bar>

        <div class="splitter sidebar-splitter"></div>
        <div class="splitter footer-splitter"></div>
      </div>
    `;
  }
}
