// Import all modules to ensure they're properly initialized
import './player.js';
import './ui.js';
import './state.js';
import './search.js';
import './albums.js';
import './visualizer.js';

// Main entry point for the DAJET music player application
document.addEventListener('DOMContentLoaded', () => {
  console.log('DAJET Music Player initialized');
  
  // Set up global error handling
  setupGlobalErrorHandling();
  
  // Initialize any remaining components
  initializeAppComponents();
});

/**
 * Set up global error handling for the application
 */
function setupGlobalErrorHandling() {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
}

/**
 * Initialize any remaining app components after modules are loaded
 */
function initializeAppComponents() {
  // Check if all required modules are available
  const requiredModules = ['player', 'ui', 'stateManager', 'search', 'albums'];
  const missingModules = requiredModules.filter(module => !window[module]);
  
  if (missingModules.length > 0) {
    console.warn('Missing modules:', missingModules);
  } else {
    console.log('All modules loaded successfully');
    
    // Dispatch an app ready event
    const appReadyEvent = new CustomEvent('appReady');
    document.dispatchEvent(appReadyEvent);
  }
}

// Export a simple API for any potential external integrations
export default {
  version: '1.0.0',
  modules: {
    player: () => import('./player.js'),
    ui: () => import('./ui.js'),
    state: () => import('./state.js'),
    search: () => import('./search.js'),
    albums: () => import('./albums.js')
  }
};