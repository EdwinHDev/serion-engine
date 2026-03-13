export interface SerionMenuItem {
    label: string;
    shortcut?: string;
    action?: string;
    submenu?: SerionMenuItem[];
}

export class SerionDropdown {
    public static create(items: SerionMenuItem[], onSelect: (action: string) => void): HTMLElement {
        const container = document.createElement('div');
        container.className = 'serion-dropdown-root';

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'dropdown-item';
            if (item.submenu) row.classList.add('has-submenu');

            row.innerHTML = `
                <span class="label">${item.label}</span>
                <div class="right-content">
                    ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
                    ${item.submenu ? `<span class="arrow">▶</span>` : ''}
                </div>
            `;

            if (item.submenu) {
                const sub = this.create(item.submenu, onSelect);
                sub.className = 'serion-submenu';
                row.appendChild(sub);
            } else if (item.action) {
                row.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSelect(item.action!);
                });
            }
            container.appendChild(row);
        });

        return container;
    }

    // Retorna el CSS necesario para inyectar en los Web Components que usen este menú
    public static getStyles(): string {
        return `
            .serion-dropdown-root, .serion-submenu {
                background: var(--serion-bg-2);
                border: 1px solid var(--serion-border);
                border-radius: 4px;
                padding: 4px 0;
                display: flex;
                flex-direction: column;
                min-width: 200px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }
            .dropdown-item {
                padding: 6px 14px;
                font-size: 13px;
                color: #ccc;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
            }
            .dropdown-item:hover { background: var(--serion-accent); color: white; }
            .right-content { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #888; }
            .dropdown-item:hover .right-content { color: rgba(255,255,255,0.8); }
            
            /* Lógica Multinivel */
            .serion-submenu {
                position: absolute;
                top: -1px;
                left: 100%;
                display: none;
            }
            .dropdown-item.has-submenu:hover > .serion-submenu { display: flex; }
        `;
    }
}
