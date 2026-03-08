import { SerionEngine, InputManager } from '@serion/engine';

/**
 * SerionViewport Component
 * Managed interface between the DOM and the Serion Engine.
 */
export class SerionViewport extends HTMLElement {
  private resizeObserver: ResizeObserver;
  private canvas: HTMLCanvasElement | null = null;
  private engine: SerionEngine = new SerionEngine();
  private statusText: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
  }

  async connectedCallback() {
    this.render();
    this.canvas = this.shadowRoot?.querySelector('#serion-canvas') as HTMLCanvasElement;
    this.statusText = this.shadowRoot?.querySelector('.status-text') as HTMLElement;

    // Inicializar Entrada de Usuario
    InputManager.initialize();

    this.resizeObserver.observe(this);
    this.handleResize();

    if (this.canvas) {
      this.setupViewportEvents();
      await this.initEngine();
    }
  }

  private setupViewportEvents() {
    if (!this.canvas) return;

    // Desactivar menú contextual para permitir uso del Click Derecho
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Gestión de Pointer Lock estilo Editor (Sólo al mantener Click Derecho)
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right Click
        this.canvas?.requestPointerLock();
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        document.exitPointerLock();
      }
    });
  }

  private async initEngine() {
    if (!this.canvas || !this.statusText) return;

    try {
      this.statusText.textContent = "INITIALIZING WEBGPU...";
      this.statusText.style.opacity = "1";

      await this.engine.start(this.canvas);

      this.statusText.style.transition = "opacity 1s ease-out";
      this.statusText.style.opacity = "0";

      setTimeout(() => {
        if (this.statusText) this.statusText.style.display = "none";
      }, 1000);

    } catch (error) {
      this.statusText.textContent = "WEBGPU ERROR - CHECK CONSOLE";
      this.statusText.style.color = "#FF4444";
      this.statusText.style.opacity = "1";
    }
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
  }

  private handleResize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
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
          font-family: var(--serion-font-family, sans-serif);
          color: var(--serion-text-dim, #888888);
          font-size: 14px;
          letter-spacing: 2px;
          opacity: 0.3;
          user-select: none;
          transition: opacity 0.3s ease;
        }

        canvas {
          display: block;
          outline: none;
        }
      </style>
      <div class="overlay">
        <div class="status-text">SERION RENDERER (WEBGPU) - READY</div>
      </div>
      <canvas id="serion-canvas" tabindex="0"></canvas>
    `;
  }
}
