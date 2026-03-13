import { SerionDropdown, SerionMenuItem } from './SerionDropdown';

export class SerionToolbar extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    connectedCallback() { this.render(); this.setupAddMenu(); }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: block; height: 44px; background: var(--serion-bg-1);
                    border-bottom: 1px solid var(--serion-border); user-select: none;
                }
                .action-bar {
                    display: grid; grid-template-columns: 1fr auto 1fr;
                    height: 100%; align-items: center; padding: 0 12px;
                }
                .group { display: flex; align-items: center; gap: 8px; }
                .center { justify-content: center; }
                .right { justify-content: flex-end; }
                
                .btn-tool {
                    background: transparent; border: none; color: #ccc; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 4px; padding: 6px; transition: background 0.1s;
                }
                .btn-tool:hover { background: var(--serion-bg-2); color: white; }
                .divider-v { width: 1px; height: 20px; background: var(--serion-border); margin: 0 4px; }

                /* Botón Add UE5 */
                .add-wrapper { position: relative; display: flex; align-items: center; }
                .btn-add {
                    background: var(--serion-bg-2); border: 1px solid var(--serion-border);
                    border-radius: 4px; padding: 4px 10px; display: flex; align-items: center; gap: 8px;
                    color: white; font-weight: 600; font-size: 13px; cursor: pointer;
                }
                .btn-add:hover { background: #333; }
                .btn-add.active { background: #444; }
                .icon-cube { fill: none; stroke: currentColor; stroke-width: 2.5; }
                .chevron-down { border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #888; margin-top: 2px; }

                /* Mode Selector */
                .mode-selector { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #ccc; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
                .mode-selector:hover { background: var(--serion-bg-2); }

                /* Dropdown Mount */
                .dropdown-mount { position: absolute; top: calc(100% + 4px); left: 0; display: none; z-index: 9999; }
                .dropdown-mount.visible { display: block; }

                ${SerionDropdown.getStyles()}
            </style>

            <div class="action-bar">
                <div class="group left">
                    <button class="btn-tool" title="Save Current Level">
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    </button>
                    <div class="mode-selector">Select Mode <div class="chevron-down"></div></div>
                    <div class="divider-v"></div>
                    <div class="add-wrapper">
                        <button class="btn-add" id="btn-quick-add">
                            <svg class="icon-cube" width="18" height="18" viewBox="0 0 24 24">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                              <circle cx="18" cy="18" r="5" fill="var(--serion-accent)" stroke="none"></circle>
                              <path d="M18 15v6M15 18h6" stroke="white" stroke-width="2"/>
                            </svg>
                            Add
                            <div class="chevron-down"></div>
                        </button>
                        <div class="dropdown-mount" id="add-menu-mount"></div>
                    </div>
                </div>

                <div class="group center">
                    <button class="btn-tool"><svg width="20" height="20" viewBox="0 0 24 24" fill="#45c46a"><path d="M8 5v14l11-7z"/></svg></button>
                    <button class="btn-tool"><svg width="20" height="20" viewBox="0 0 24 24" fill="#ccc"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button>
                    <button class="btn-tool"><svg width="20" height="20" viewBox="0 0 24 24" fill="#ff4d4d"><rect x="6" y="6" width="12" height="12"/></svg></button>
                </div>

                <div class="group right">
                    <button class="btn-tool" style="font-size: 13px; gap: 6px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Settings
                    </button>
                </div>
            </div>
        `;
    }

    private setupAddMenu() {
        const items: SerionMenuItem[] = [
            { label: 'Basic', submenu: [{ label: 'Empty Actor', action: 'spawn:empty' }] },
            { label: 'Shapes', submenu: [
                { label: 'Cube', action: 'spawn:cube' },
                { label: 'Sphere', action: 'spawn:sphere' },
                { label: 'Plane', action: 'spawn:plane' },
                { label: 'Cylinder', action: 'spawn:cylinder' },
                { label: 'Cone', action: 'spawn:cone' },
                { label: 'Capsule', action: 'spawn:capsule' }
            ]},
            { label: 'Lights', submenu: [
                { label: 'Directional Light', action: 'spawn:dir-light' },
                { label: 'Point Light', action: 'spawn:point-light' }
            ]}
        ];

        const mount = this.shadowRoot!.getElementById('add-menu-mount')!;
        const btn = this.shadowRoot!.getElementById('btn-quick-add')!;

        mount.appendChild(SerionDropdown.create(items, (action) => {
            if (action.startsWith('spawn:')) {
                const type = action.split(':')[1];
                
                // Emite el evento global desacoplado
                window.dispatchEvent(new CustomEvent('serion:spawn-actor', {
                    detail: { type }
                }));

                // Cierra el menú para una UX limpia
                mount.classList.remove('visible');
                btn.classList.remove('active');
            }
        }));

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            mount.classList.toggle('visible');
            btn.classList.toggle('active');
        });

        window.addEventListener('click', () => {
            mount.classList.remove('visible');
            btn.classList.remove('active');
        });
    }
}
if (!customElements.get('serion-toolbar')) customElements.define('serion-toolbar', SerionToolbar);
