/**
 * SerionViewport Component
 * The main rendering area for the engine.
 */

export class SerionViewport extends HTMLElement {
  private resizeObserver: ResizeObserver;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        this.handleResize(entry.contentRect.width, entry.contentRect.height);
      }
    });
  }

  connectedCallback() {
    this.render();
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
  }

  private handleResize(width: number, height: number) {
    // In the future, this will update the WebGPU Renderer's aspect ratio
    console.log(`Viewport Resized: ${width}x${height}`);
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          background-color: #050505;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
        }

        .status-text {
          font-family: var(--serion-font-family);
          color: var(--serion-text-dim);
          font-size: 14px;
          letter-spacing: 2px;
          opacity: 0.5;
        }

        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
      <div class="overlay">
        <div class="status-text">SERION RENDERER (WEBGPU) - READY</div>
      </div>
      <canvas id="serion-canvas"></canvas>
    `;
  }
}
