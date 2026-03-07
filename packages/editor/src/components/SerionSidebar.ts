/**
 * SerionSidebar Component
 * Vertical panel for Outliner and Details.
 */

export class SerionSidebar extends HTMLElement {
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
          border-left: 1px solid var(--serion-border);
          height: 100%;
          width: var(--serion-sidebar-width);
        }

        .panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
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
        }

        .content {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
          color: var(--serion-text-dim);
        }

        .empty-state {
          font-style: italic;
          opacity: 0.5;
        }
      </style>
      
      <!-- Outliner Panel -->
      <div class="panel">
        <div class="header">
          Outliner
          <span style="font-size: 8px;">▼</span>
        </div>
        <div class="content">
          <div class="empty-state">No actors in scene...</div>
        </div>
      </div>

      <!-- Details Panel -->
      <div class="panel">
        <div class="header">
          Details
          <span style="font-size: 8px;">▼</span>
        </div>
        <div class="content">
          <div class="empty-state">Select an object to see details.</div>
        </div>
      </div>
    `;
  }
}
