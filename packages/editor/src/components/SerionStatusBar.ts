/**
 * SerionStatusBar Component - Barra de Estado y Telemetría.
 * Capa 13.6: UI Fase 1 - Telemetría.
 */
export class SerionStatusBar extends HTMLElement {
  private metricsElement: HTMLElement | null = null;
  private statusMsgElement: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    window.addEventListener('serion:telemetry', this.handleTelemetry as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('serion:telemetry', this.handleTelemetry as EventListener);
  }

  private handleTelemetry = (e: Event) => {
    if (!this.metricsElement) return;
    const detail = (e as CustomEvent).detail;
    if (!detail) return;
    const { fps, ms, visibleActors, totalActors } = detail;
    this.metricsElement.textContent = `FPS: ${fps} | ${ms} ms | Vis: ${visibleActors}/${totalActors}`;
  };

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          background-color: var(--serion-bg-2, #1a1a1a);
          color: #a0a0a0;
          padding: 0 12px;
          font-size: 11px;
          height: 24px;
          border-top: 1px solid var(--serion-border, #333);
          gap: 1rem;
          user-select: none;
          font-family: 'Inter', sans-serif;
        }

        .item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background-color: #2ecc71;
          border-radius: 50%;
          box-shadow: 0 0 4px rgba(46, 204, 113, 0.5);
        }

        .right {
          margin-left: auto;
          display: flex;
          gap: 1.5rem;
        }

        #metrics {
          font-family: 'JetBrains Mono', monospace;
          color: var(--serion-accent, #3498db);
        }
      </style>
      <div class="item">
        <div class="status-dot"></div>
        <span id="status-msg">Serion Engine Ready</span>
      </div>
      
      <div class="right">
        <span id="metrics">FPS: -- | -- ms | Vis: --/--</span>
        <div class="item">Serion Engine v1.0.0-dev</div>
      </div>
    `;

    this.metricsElement = this.shadowRoot.querySelector('#metrics');
    this.statusMsgElement = this.shadowRoot.querySelector('#status-msg');
  }
}

if (!customElements.get('serion-status-bar')) {
  customElements.define('serion-status-bar', SerionStatusBar);
}
