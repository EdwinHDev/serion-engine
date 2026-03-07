/**
 * SerionToolbar Component
 * Encapsulates the top tools and menus area.
 */

export class SerionToolbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          background-color: var(--serion-bg-1);
          border-bottom: 1px solid var(--serion-border);
          padding: 0 1rem;
          gap: 1.5rem;
          color: var(--serion-text-main);
          user-select: none;
        }

        .logo {
          font-weight: bold;
          color: #fff;
          letter-spacing: 1px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logo span {
          color: var(--serion-accent);
        }

        .nav-items {
          display: flex;
          gap: 1rem;
        }

        .nav-item {
          cursor: pointer;
          color: var(--serion-text-dim);
          transition: color 0.2s;
        }

        .nav-item:hover {
          color: var(--serion-text-main);
        }

        .action-button {
          background-color: var(--serion-accent);
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          margin-left: auto;
        }

        .action-button:hover {
          background-color: var(--serion-accent-hover);
        }
      </style>
      <div class="logo">SERION<span>ENGINE</span></div>
      <div class="nav-items">
        <div class="nav-item">File</div>
        <div class="nav-item">Edit</div>
        <div class="nav-item">Window</div>
        <div class="nav-item">Tools</div>
        <div class="nav-item">Build</div>
        <div class="nav-item">Help</div>
      </div>
      <button class="action-button">SELECT MODE</button>
    `;
  }
}
