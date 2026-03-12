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
  // Función auxiliar para registrar de forma segura (Compatible con Vite HMR)
  const defineSafe = (tag: string, constructor: CustomElementConstructor) => {
    if (!customElements.get(tag)) {
      customElements.define(tag, constructor);
    }
  };
  defineSafe('serion-editor-shell', SerionEditorShell);
  defineSafe('serion-toolbar', SerionToolbar);
  defineSafe('serion-viewport', SerionViewport);
  defineSafe('serion-sidebar', SerionSidebar);
  defineSafe('serion-content-browser', SerionContentBrowser);
  defineSafe('serion-status-bar', SerionStatusBar);
  defineSafe('serion-asset-item', SerionAssetItem);
  defineSafe('serion-dropdown', SerionDropdown);
  defineSafe('serion-mode-panel', SerionModePanel);
};

// Initialize Application
registerComponents();

import { MenuManager } from './components/MenuManager';
MenuManager.initializeDefaultShortcuts();

// Add global dropdown instance to body
const dropdown = document.createElement('serion-dropdown');
document.body.appendChild(dropdown);

// Add global mode panel instance to body
const modePanel = document.createElement('serion-mode-panel');
document.body.appendChild(modePanel);

// console.log('Serion Editor initialized successfully.');
