/**
 * SerionToolbar Component
 * High-fidelity top navigation inspired by UE5.
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
          padding: 0 0.5rem;
          gap: 1rem;
          color: var(--serion-text-main);
          user-select: none;
          height: var(--serion-toolbar-height);
        }

        .logo {
          font-weight: 800;
          color: #fff;
          letter-spacing: 1.5px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 1rem;
        }

        .logo span {
          color: var(--serion-accent);
        }

        .nav-items {
          display: flex;
          height: 100%;
        }

        .nav-item {
          display: flex;
          align-items: center;
          padding: 0 12px;
          cursor: pointer;
          color: var(--serion-text-main);
          font-size: 12px;
          transition: background-color 0.15s, color 0.15s;
          height: 100%;
        }

        .nav-item:hover {
          background-color: var(--serion-bg-2);
          color: #fff;
        }

        .action-button {
          background-color: var(--serion-accent);
          color: white;
          border: none;
          padding: 6px 16px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          margin-left: auto;
          margin-right: 1rem;
          text-transform: uppercase;
          transition: background-color 0.2s;
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
      <button class="action-button">Select Mode</button>
    `;
  }
}
