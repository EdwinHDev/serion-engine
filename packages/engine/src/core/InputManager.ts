/**
 * InputManager.ts - Gestión global de entrada de usuario.
 * Soporta teclado y movimiento del ratón para navegación 3D.
 */
export class InputManager {
  private static keys: Set<string> = new Set();
  private static mouseX: number = 0;
  private static mouseY: number = 0;

  // Estado del clic derecho para navegación estilo Unreal
  public static isRightMouseDown: boolean = false;

  /**
   * Inicializa los listeners globales.
   */
  public static initialize(): void {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Captura de botones del ratón
    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.isRightMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.isRightMouseDown = false;
    });

    // Captura de movimiento del ratón (Delta)
    window.addEventListener('mousemove', (e) => {
      // Solo acumulamos si hay algún tipo de captura activa (Pointer Lock o Right Click)
      if (document.pointerLockElement || this.isRightMouseDown) {
        this.mouseX += e.movementX;
        this.mouseY += e.movementY;
      }
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseX = 0;
      this.mouseY = 0;
      this.isRightMouseDown = false;
    });
  }

  /**
   * Retorna el delta del ratón acumulado y lo resetea para el próximo frame.
   */
  public static consumeMouseDelta(): { x: number, y: number } {
    const delta = { x: this.mouseX, y: this.mouseY };
    this.mouseX = 0;
    this.mouseY = 0;
    return delta;
  }

  public static isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }
}
