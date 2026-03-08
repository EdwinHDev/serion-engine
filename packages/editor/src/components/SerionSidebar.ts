/**
 * SerionSidebar Component
 * Refined visual fidelity for a professional look.
 */

export class SerionSidebar extends HTMLElement {
  private collapsedPanels: Set<string> = new Set();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private togglePanel(panelId: string) {
    if (this.collapsedPanels.has(panelId)) {
      this.collapsedPanels.delete(panelId);
    } else {
      this.collapsedPanels.add(panelId);
    }
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    const isOutlinerCollapsed = this.collapsedPanels.has('outliner');
    const isDetailsCollapsed = this.collapsedPanels.has('details');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          background-color: var(--serion-bg-1);
          border-left: 1px solid var(--serion-border);
          height: 100%;
          width: 100%;
          min-width: 200px;
          overflow: hidden;
        }

        .panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .panel.expanded {
          flex: 1;
        }

        .panel.collapsed {
          flex: 0 0 auto;
        }

        .panel:not(:last-child) {
          border-bottom: 1px solid var(--serion-border);
        }

        .header {
          background-color: var(--serion-bg-2);
          padding: 10px 14px; /* Increased padding */
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--serion-text-main); /* Softer white */
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
          transition: background-color 0.15s;
        }

        .header:hover {
          background-color: #2e2e2e; /* Subtle hover */
          color: #fff;
        }

        .arrow {
          font-size: 8px;
          opacity: 0.5;
          transition: transform 0.2s;
        }

        .arrow.collapsed {
          transform: rotate(-90deg);
        }

        .content {
          flex: 1;
          padding: 1.25rem;
          overflow-y: auto;
          color: var(--serion-text-dim);
          background-color: var(--serion-bg-1);
        }

        .panel.collapsed .content {
          display: none;
        }

        .empty-state {
          font-style: italic;
          font-size: 11px;
          opacity: 0.4;
        }
      </style>
      
      <div class="panel ${isOutlinerCollapsed ? 'collapsed' : 'expanded'}">
        <div class="header" id="outliner-header">
          Outliner
          <span class="arrow ${isOutlinerCollapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="content">
          <div class="empty-state">No actors in scene...</div>
        </div>
      </div>

      <div class="panel ${isDetailsCollapsed ? 'collapsed' : 'expanded'}">
        <div class="header" id="details-header">
          Details
          <span class="arrow ${isDetailsCollapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="content">
          <div class="empty-state">Select an object to see details.</div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('outliner-header')?.addEventListener('click', () => this.togglePanel('outliner'));
    this.shadowRoot.getElementById('details-header')?.addEventListener('click', () => this.togglePanel('details'));
  }
}
