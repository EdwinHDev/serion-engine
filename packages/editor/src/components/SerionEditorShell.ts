/**
 * SerionEditorShell Component
 * Master Layout Orchestrator using CSS Grid.
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

    sidebarSplitter.addEventListener('mousedown', (e) => {
      this.isResizingSidebar = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    footerSplitter.addEventListener('mousedown', (e) => {
      this.isResizingFooter = true;
      document.body.style.cursor = 'row-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isResizingSidebar) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 150 && newWidth < 600) {
          this.sidebarWidth = newWidth;
          this.updateLayout();
        }
      }

      if (this.isResizingFooter) {
        const newHeight = window.innerHeight - e.clientY - 24; // 24 is statusbar height
        if (newHeight > 100 && newHeight < 500) {
          this.footerHeight = newHeight;
          this.updateLayout();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isResizingSidebar = false;
      this.isResizingFooter = false;
      document.body.style.cursor = 'default';
    });
  }

  private updateLayout() {
    const container = this.shadowRoot?.querySelector('.shell-container') as HTMLElement;
    if (container) {
      container.style.gridTemplateColumns = `1fr ${this.sidebarWidth}px`;
      container.style.gridTemplateRows = `var(--serion-toolbar-height) 1fr ${this.footerHeight}px var(--serion-statusbar-height)`;
    }
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        .shell-container {
          display: grid;
          grid-template-areas:
            "toolbar toolbar"
            "main-area sidebar"
            "footer sidebar"
            "statusbar statusbar";
          grid-template-rows: var(--serion-toolbar-height) 1fr ${this.footerHeight}px var(--serion-statusbar-height);
          grid-template-columns: 1fr ${this.sidebarWidth}px;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
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
          z-index: 100;
          transition: background 0.2s;
        }

        .splitter:hover {
          background: var(--serion-accent);
        }

        .sidebar-splitter {
          top: var(--serion-toolbar-height);
          bottom: var(--serion-statusbar-height);
          right: ${this.sidebarWidth - 2}px;
          width: var(--serion-splitter-width);
          cursor: col-resize;
        }

        .footer-splitter {
          bottom: calc(var(--serion-statusbar-height) + ${this.footerHeight - 2}px);
          left: 0;
          right: ${this.sidebarWidth}px;
          height: var(--serion-splitter-width);
          cursor: row-resize;
        }
      </style>
      
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
