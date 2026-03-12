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
  private isDraggingGizmo = false;

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

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      // Si el puntero está bloqueado (navegación), no hacemos nada de Gizmos
      if (document.pointerLockElement) return;

      const ndcX = (e.offsetX / this.canvas!.clientWidth) * 2 - 1; 
      const ndcY = -(e.offsetY / this.canvas!.clientHeight) * 2 + 1;

      if (this.isDraggingGizmo) {
        const snapEnabled = EditorState.snapTranslationEnabled;
        const snapValue = EditorState.snapTranslationValue;
        this.engine.updateGizmoDrag(ndcX, ndcY, snapEnabled, snapValue);
        return; 
      }
      
      // Hover Visual
      const hoveredGizmoPart = this.engine.pickGizmo(ndcX, ndcY);
      this.canvas!.style.cursor = hoveredGizmoPart ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right Click
        this.canvas?.requestPointerLock();
      } else if (e.button === 0) { // Left Click
        const ndcX = (e.offsetX / this.canvas!.clientWidth) * 2 - 1; 
        const ndcY = -(e.offsetY / this.canvas!.clientHeight) * 2 + 1;

        if (this.engine.isGizmoHovered()) {
          this.isDraggingGizmo = true;
          this.engine.beginGizmoDrag(ndcX, ndcY);
          return; 
        }

        const hitId = this.engine.pickActor(ndcX, ndcY);
        if (hitId !== null) {
          EditorState.selectActor(hitId, e.ctrlKey || e.metaKey);
        } else {
          EditorState.clearSelection();
        }
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 2) {
        document.exitPointerLock();
      } else if (e.button === 0) {
        if (this.isDraggingGizmo) {
          this.isDraggingGizmo = false;
          this.engine.endGizmoDrag();
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
      <serion-viewport-overlay></serion-viewport-overlay>
    `;
  }
}
