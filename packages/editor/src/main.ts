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
};

// Initialize Application
registerComponents();

console.log('Serion Editor initialized successfully.');
