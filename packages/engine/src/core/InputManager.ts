/**
 * InputManager.ts - Gestión global de entrada de usuario.
 * Siguiendo el principio de acceso estático para facilidad de uso en el bucle del motor.
 */
export class InputManager {
  private static keys: Set<string> = new Set();

  /**
   * Inicializa los listeners globales.
   * Nota: Se llama desde el Viewport del Editor.
   */
  public static initialize(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Limpiar rastro al perder foco
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  /**
   * Verifica si una tecla está presionada actualmente.
   * @param code Código de la tecla (ej. 'KeyW', 'Space', 'ShiftLeft')
   */
  public static isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }
}
