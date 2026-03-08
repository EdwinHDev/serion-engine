/**
 * Serion Engine Editor - Main Entry Point
 */

// Import Global Styles
import './theme.css';

// Import Components
import { SerionEditorShell } from './components/SerionEditorShell';
import { SerionToolbar } from './components/SerionToolbar';
import { SerionViewport } from './components/SerionViewport';
import { SerionSidebar } from './components/SerionSidebar';
import { SerionContentBrowser } from './components/SerionContentBrowser';
import { SerionStatusBar } from './components/SerionStatusBar';
import { SerionAssetItem } from './components/SerionAssetItem';
import { SerionDropdown } from './components/SerionDropdown';
import { SerionModePanel } from './components/SerionModePanel';

/**
 * Register Custom Elements
 */
const registerComponents = () => {
  customElements.define('serion-editor-shell', SerionEditorShell);
  customElements.define('serion-toolbar', SerionToolbar);
  customElements.define('serion-viewport', SerionViewport);
  customElements.define('serion-sidebar', SerionSidebar);
  customElements.define('serion-content-browser', SerionContentBrowser);
  customElements.define('serion-status-bar', SerionStatusBar);
  customElements.define('serion-asset-item', SerionAssetItem);
  customElements.define('serion-dropdown', SerionDropdown);
  customElements.define('serion-mode-panel', SerionModePanel);
};

// Initialize Application
registerComponents();

// Add global dropdown instance to body
const dropdown = document.createElement('serion-dropdown');
document.body.appendChild(dropdown);

// Add global mode panel instance to body
const modePanel = document.createElement('serion-mode-panel');
document.body.appendChild(modePanel);

console.log('Serion Editor initialized successfully.');
