/**
 * SerionViewport Component
 * Fixed DPI scaling to ensure crisp rendering on high-res displays.
 */

export class SerionViewport extends HTMLElement {
  private resizeObserver: ResizeObserver;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
  }

  connectedCallback() {
    this.render();
    this.canvas = this.shadowRoot?.querySelector('#serion-canvas') as HTMLCanvasElement;
    this.resizeObserver.observe(this);
    this.handleResize();
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
  }

  private handleResize() {
    if (!this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = this.getBoundingClientRect();

    // Adjust internal resolution based on DPI
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Maintain layout size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    console.log(`Viewport Resized (DPI Adjusted): ${this.canvas.width}x${this.canvas.height}`);

    // Future: Update renderer viewport/camera here
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
          z-index: 10;
        }

        .status-text {
          font-family: var(--serion-font-family);
          color: var(--serion-text-dim);
          font-size: 14px;
          letter-spacing: 2px;
          opacity: 0.3;
          user-select: none;
        }

        canvas {
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
