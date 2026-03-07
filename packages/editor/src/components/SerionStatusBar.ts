/**
 * SerionStatusBar Component
 * Technical info and status messages.
 */

export class SerionStatusBar extends HTMLElement {
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
          align-items: center;
          background-color: var(--serion-accent);
          color: white;
          padding: 0 12px;
          font-size: 10px;
          gap: 1rem;
          user-select: none;
        }

        .item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background-color: #00ff00;
          border-radius: 50%;
        }

        .right {
          margin-left: auto;
          display: flex;
          gap: 1rem;
        }
      </style>
      <div class="item">
        <div class="status-dot"></div>
        Ready
      </div>
      <div class="item">WebGPU: Active</div>
      <div class="item">Garbage Collector: Optimized</div>
      <div class="right">
        <div class="item">FPS: 60</div>
        <div class="item">Serion Engine v1.0.0</div>
      </div>
    `;
  }
}
