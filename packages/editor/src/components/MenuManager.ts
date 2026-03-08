/**
 * MenuManager Singleton
 * Manages the state of active dropdowns and global interaction.
 */

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
}
