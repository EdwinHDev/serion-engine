/**
 * SerionSidebar Component
 * Functional collapsible panels for Outliner and Details.
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
          min-width: 200px; /* Enforce min-width */
          overflow: hidden;
        }

        .panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
          transition: flex 0.2s ease-in-out;
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
          padding: 8px 12px;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }

        .header:hover {
          background-color: #333;
        }

        .arrow {
          font-size: 8px;
          transition: transform 0.2s;
          display: inline-block;
        }

        .arrow.collapsed {
          transform: rotate(-90deg);
        }

        .content {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
          color: var(--serion-text-dim);
          background-color: var(--serion-bg-1);
        }

        .panel.collapsed .content {
          display: none;
        }

        .empty-state {
          font-style: italic;
          opacity: 0.5;
        }
      </style>
      
      <!-- Outliner Panel -->
      <div class="panel ${isOutlinerCollapsed ? 'collapsed' : 'expanded'}">
        <div class="header" id="outliner-header">
          Outliner
          <span class="arrow ${isOutlinerCollapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="content">
          <div class="empty-state">No actors in scene...</div>
        </div>
      </div>

      <!-- Details Panel -->
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

    // Add event listeners
    this.shadowRoot.getElementById('outliner-header')?.addEventListener('click', () => this.togglePanel('outliner'));
    this.shadowRoot.getElementById('details-header')?.addEventListener('click', () => this.togglePanel('details'));
  }
}
