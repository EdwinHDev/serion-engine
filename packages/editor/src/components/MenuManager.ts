/**
 * MenuManager Singleton
 * Manages the state of active dropdowns and global interaction.
 */

import { EditorState } from '../core/EditorState';

export class MenuManager {
  private static instance: MenuManager;
  private activeDropdown: HTMLElement | null = null;

  private constructor() {
    window.addEventListener('mousedown', (e) => this.handleOutsideClick(e));
    window.addEventListener('blur', () => this.closeActiveMenu());
  }

  public static getInstance(): MenuManager {
    if (!MenuManager.instance) {
      MenuManager.instance = new MenuManager();
    }
    return MenuManager.instance;
  }

  public setActiveMenu(menu: HTMLElement | null) {
    if (this.activeDropdown && this.activeDropdown !== menu) {
      this.closeActiveMenu();
    }
    this.activeDropdown = menu;
  }

  public hasActiveMenu(): boolean {
    return this.activeDropdown !== null;
  }

  public closeActiveMenu() {
    if (this.activeDropdown) {
      // We assume the menu component has a close method or we dispatch an event
      this.activeDropdown.dispatchEvent(new CustomEvent('serion-menu-close'));
      this.activeDropdown = null;
    }
  }

  private handleOutsideClick(e: MouseEvent) {
    if (!this.activeDropdown) return;

    const path = e.composedPath();
    if (!path.includes(this.activeDropdown)) {
      this.closeActiveMenu();
    }
  }

  // --- SHORTCUT MANAGER ---
  private static shortcuts: Map<string, { id: string, callback: () => void }> = new Map();
  private static isListeningShortcuts = false;

  /**
   * Registra un atajo de teclado global.
   * @param id Identificador único de la acción (ej. 'Transform.Translate')
   * @param key Tecla asignada (ej. 'w', 'ctrl+s')
   * @param callback Función a ejecutar
   */
  public static registerShortcut(id: string, key: string, callback: () => void): void {
    const normalizedKey = key.toLowerCase();
    if (this.shortcuts.has(normalizedKey)) {
      console.warn(`[MenuManager] Atajo '${normalizedKey}' ya está asignado. Sobrescribiendo con '${id}'.`);
    }
    this.shortcuts.set(normalizedKey, { id, callback });

    if (!this.isListeningShortcuts) {
      this.startShortcutListener();
    }
  }

  private static startShortcutListener(): void {
    this.isListeningShortcuts = true;
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // REGLA 1: Ignorar atajos si la cámara está volando (Clic derecho presionado)
      if (EditorState.isNavigating) return;

      // REGLA 2: Ignorar si el usuario está escribiendo en un input, textarea o contenteditable
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        const isInput = tag === 'input' || tag === 'textarea';
        const isEditable = (activeEl as HTMLElement).isContentEditable;
        if (isInput || isEditable) return;
      }

      // Construir el string del atajo (ej. 'ctrl+s', 'w')
      let keyStr = '';
      if (e.ctrlKey || e.metaKey) keyStr += 'ctrl+';
      if (e.shiftKey) keyStr += 'shift+';
      if (e.altKey) keyStr += 'alt+';
      keyStr += e.key.toLowerCase();

      const shortcut = this.shortcuts.get(keyStr);
      if (shortcut) {
        // No aplicamos preventDefault a atajos simples como W, A, S, D si queremos que la cámara de vuelo los use, 
        // pero sí disparamos el callback. 
        shortcut.callback();
      }
    });
  }

  public static initializeDefaultShortcuts(): void {
    // Atajos de Transformación (Estándar Unreal)
    this.registerShortcut('Transform.Select', 'q', () => EditorState.setTransformMode('select'));
    this.registerShortcut('Transform.Translate', 'w', () => EditorState.setTransformMode('translate'));
    this.registerShortcut('Transform.Rotate', 'e', () => EditorState.setTransformMode('rotate'));
    this.registerShortcut('Transform.Scale', 'r', () => EditorState.setTransformMode('scale'));
  }
}
