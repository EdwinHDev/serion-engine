import { SerionEngine, InputManager } from '@serion/engine';
import { EditorState } from '../core/EditorState';

/**
 * SerionViewport Component
 * Managed interface between the DOM and the Serion Engine.
 * Capa 10.6: Just-In-Time Resolution (No ResizeObserver).
 */
export class SerionViewport extends HTMLElement {
  private canvas: HTMLCanvasElement | null = null;
  private engine: SerionEngine = new SerionEngine();
  private statusText: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    this.render();
    this.canvas = this.shadowRoot?.querySelector('#serion-canvas') as HTMLCanvasElement;
    this.statusText = this.shadowRoot?.querySelector('.status-text') as HTMLElement;

    if (this.canvas) {
      // Delegación de tamaño al CSS (100% Contenedor)
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';

      // Inicializar Entrada de Usuario
      InputManager.initialize();

      this.setupViewportEvents();
      await this.initEngine();
    }
  }

  private setupViewportEvents() {
    if (!this.canvas) return;

    // Desactivar menú contextual para permitir uso del Click Derecho
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    let isDragging = false;
    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      isDragging = true;
      
      // Si el puntero está bloqueado (navegación), no hacemos hover
      if (document.pointerLockElement) return;

      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ndcX = (x / rect.width) * 2 - 1;
      const ndcY = -(y / rect.height) * 2 + 1;

      // Preguntarle al motor si estamos tocando el Gizmo
      const hoveredGizmoPart = this.engine.pickGizmo(ndcX, ndcY);
      if (hoveredGizmoPart) {
        this.canvas!.style.cursor = 'pointer'; 
      } else {
        this.canvas!.style.cursor = 'default';
      }
    });

    // Gestión de Pointer Lock estilo Editor (Sólo al mantener Click Derecho)
    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = false;
      if (e.button === 2) { // Right Click
        this.canvas?.requestPointerLock();
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        document.exitPointerLock();
      } else if (e.button === 0 && !isDragging) {
        // Clic Izquierdo - Mouse Picking API WebGPU
        const rect = this.canvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ndcX = (x / rect.width) * 2 - 1;
        const ndcY = -(y / rect.height) * 2 + 1; // Y invertido para WebGPU

        const hitId = this.engine.pickActor(ndcX, ndcY);
        if (hitId !== null) {
          EditorState.selectActor(hitId, e.ctrlKey || e.metaKey);
        } else {
          EditorState.clearSelection();
        }
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
    // El motor se detiene automáticamente si el canvas es destruido
    // No hace falta desconectar observadores.
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
