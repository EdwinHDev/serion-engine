export class SerionTabManager extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    connectedCallback() { this.render(); }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: flex; height: 32px; background: var(--serion-bg-0);
                    padding-top: 4px; padding-left: 8px; gap: 2px; user-select: none;
                }
                .tab {
                    display: flex; align-items: center; gap: 8px;
                    padding: 0 12px; background: var(--serion-bg-2);
                    border-radius: 6px 6px 0 0; color: #aaa; font-size: 12px;
                    cursor: pointer; border: 1px solid transparent; border-bottom: none;
                    position: relative;
                }
                .tab.active {
                    background: var(--serion-bg-1); color: white;
                    border-color: var(--serion-border); font-weight: 600;
                }
                .tab:not(.active):hover { background: #333; }
                .tab-name { display: flex; align-items: center; gap: 4px; }
                .dirty-star { color: var(--serion-accent); display: none; }
                .tab.dirty .dirty-star { display: inline; }
                
                .btn-close {
                    width: 16px; height: 16px; border-radius: 50%; display: flex;
                    justify-content: center; align-items: center; opacity: 0; transition: opacity 0.2s;
                }
                .tab:hover .btn-close, .tab.active .btn-close { opacity: 1; }
                .btn-close:hover { background: rgba(255,255,255,0.1); }
            </style>
            <div class="tab active dirty" title="SWorld_Main">
                <div class="tab-name">Level_Main <span class="dirty-star">*</span></div>
                <div class="btn-close"><svg width="10" height="10" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>
            </div>
        `;
    }
}
customElements.define('serion-tab-manager', SerionTabManager);
