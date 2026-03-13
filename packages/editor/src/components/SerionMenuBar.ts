import { SerionDropdown } from './SerionDropdown';

export class SerionMenuBar extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    connectedCallback() { this.render(); this.setupMenus(); }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: flex; justify-content: space-between; align-items: center;
                    height: 28px; background: var(--serion-bg-0); border-bottom: 1px solid #000;
                    padding: 0 12px; font-size: 13px; color: #ccc; user-select: none;
                }
                .left { display: flex; align-items: center; gap: 16px; }
                .logo { font-weight: 800; color: white; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
                .logo svg { width: 14px; height: 14px; fill: var(--serion-accent); }
                .menu-bar { display: flex; gap: 4px; }
                .menu-trigger { padding: 4px 8px; cursor: pointer; border-radius: 4px; position: relative; }
                .menu-trigger:hover, .menu-trigger.active { background: var(--serion-bg-2); color: white; }
                .project-name { font-weight: 600; color: #888; }
                
                .dropdown-mount {
                    position: absolute; top: 100%; left: 0; display: none; z-index: 10000;
                }
                .dropdown-mount.visible { display: block; }
                ${SerionDropdown.getStyles()}
            </style>
            <div class="left">
                <div class="logo">
                   <svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                   SERION
                </div>
                <div class="menu-bar">
                    <div class="menu-trigger" id="menu-file">File<div class="dropdown-mount" id="mount-file"></div></div>
                    <div class="menu-trigger" id="menu-edit">Edit<div class="dropdown-mount" id="mount-edit"></div></div>
                    <div class="menu-trigger" id="menu-window">Window<div class="dropdown-mount" id="mount-window"></div></div>
                    <div class="menu-trigger" id="menu-help">Help<div class="dropdown-mount" id="mount-help"></div></div>
                </div>
            </div>
            <div class="project-name">MyProject - Serion Editor</div>
        `;
    }

    private setupMenus() {
        const menusConfig = [
            { id: 'menu-file', mount: 'mount-file', items: [
                { label: 'New Level...', shortcut: 'Ctrl+N', action: 'file:new-level' },
                { label: 'Save Current Level', shortcut: 'Ctrl+S', action: 'file:save' },
                { label: 'Save All', shortcut: 'Ctrl+Shift+S', action: 'file:save-all' }
            ]},
            { id: 'menu-edit', mount: 'mount-edit', items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', action: 'edit:undo' },
                { label: 'Redo', shortcut: 'Ctrl+Y', action: 'edit:redo' }
            ]},
            { id: 'menu-window', mount: 'mount-window', items: [
                { label: 'Content Browser', action: 'window:content' },
                { label: 'Details Panel', action: 'window:details' }
            ]},
            { id: 'menu-help', mount: 'mount-help', items: [
                { label: 'Serion Engine Documentation', action: 'help:docs' },
                { label: 'About', action: 'help:about' }
            ]}
        ];

        let isMenuModeActive = false;
        const triggers: HTMLElement[] = [];
        const mounts: HTMLElement[] = [];

        const closeAll = () => {
            isMenuModeActive = false;
            triggers.forEach(t => t.classList.remove('active'));
            mounts.forEach(m => m.classList.remove('visible'));
        };

        const openMenu = (trigger: HTMLElement, mount: HTMLElement) => {
            triggers.forEach(t => t.classList.remove('active'));
            mounts.forEach(m => m.classList.remove('visible'));
            trigger.classList.add('active');
            mount.classList.add('visible');
        };

        menusConfig.forEach(config => {
            const trigger = this.shadowRoot!.getElementById(config.id);
            const mount = this.shadowRoot!.getElementById(config.mount);
            if (!trigger || !mount) return;

            triggers.push(trigger);
            mounts.push(mount);

            if (config.items.length > 0) {
                mount.appendChild(SerionDropdown.create(config.items, (action) => {
                    console.log('[Serion Menu] Action triggered:', action);
                    closeAll(); // Cierra el menú al hacer clic en una opción
                }));
            }

            // Iniciar modo menú al hacer clic
            trigger.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (trigger.classList.contains('active')) {
                    closeAll();
                } else {
                    isMenuModeActive = true;
                    openMenu(trigger, mount);
                }
            });

            // Cambiar de menú automáticamente si el modo menú está activo
            trigger.addEventListener('mouseenter', () => {
                if (isMenuModeActive && !trigger.classList.contains('active')) {
                    openMenu(trigger, mount);
                }
            });
        });

        // Click fuera para cerrar
        window.addEventListener('mousedown', closeAll);
    }
}
customElements.define('serion-menu-bar', SerionMenuBar);
