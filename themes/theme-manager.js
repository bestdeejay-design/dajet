/**
 * Theme Manager Module
 * Handles theme switching and management
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.themes = ['dark', 'lounge'];
    this.themeChangeCallbacks = [];
    
    // Initialize theme
    this.init();
  }
  
  // Initialize theme manager
  init() {
    // Load saved theme from localStorage
    this.loadFromStorage();
    
    // Apply the current theme
    this.applyTheme(this.currentTheme);
    
    // Listen for system theme preference changes
    this.listenForSystemThemeChanges();
  }
  
  // Apply a theme to the document
  applyTheme(themeName) {
    if (!this.themes.includes(themeName)) {
      console.warn(`Theme '${themeName}' does not exist. Available themes: ${this.themes.join(', ')}`);
      return false;
    }
    
    // Update the data attribute on the root element
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Update internal state
    this.currentTheme = themeName;
    
    // Update any theme-dependent elements
    this.updateThemeDependentElements();
    
    // Notify listeners
    this.notifyThemeChange(themeName);
    
    return true;
  }
  
  // Set theme by name
  setTheme(themeName) {
    if (this.applyTheme(themeName)) {
      // Save to localStorage
      this.saveToStorage();
      return true;
    }
    return false;
  }
  
  // Toggle between available themes
  toggle() {
    const currentIndex = this.themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    return this.setTheme(this.themes[nextIndex]);
  }
  
  // Get current theme
  getCurrentTheme() {
    return this.currentTheme;
  }
  
  // Get available themes
  getAvailableThemes() {
    return [...this.themes];
  }
  
  // Register callback for theme changes
  onThemeChange(callback) {
    if (typeof callback === 'function') {
      this.themeChangeCallbacks.push(callback);
      return () => {
        // Return an unsubscribe function
        this.themeChangeCallbacks = this.themeChangeCallbacks.filter(cb => cb !== callback);
      };
    }
  }
  
  // Notify all listeners about theme change
  notifyThemeChange(themeName) {
    this.themeChangeCallbacks.forEach(callback => {
      try {
        callback(themeName);
      } catch (error) {
        console.error('Error in theme change callback:', error);
      }
    });
  }
  
  // Update theme-dependent elements
  updateThemeDependentElements() {
    // Update SVG backgrounds if they exist
    this.updateSvgBackgrounds();
    
    // Update any other theme-dependent elements
    this.updateThemeControls();
  }
  
  // Update SVG backgrounds based on theme
  updateSvgBackgrounds() {
    const backgroundContainer = document.getElementById('theme-background');
    if (!backgroundContainer) return;
    
    // Clear existing background
    backgroundContainer.innerHTML = '';
    
    // Determine which SVG to load based on theme
    let svgPath = '';
    switch (this.currentTheme) {
      case 'lounge':
        svgPath = 'themes/lounge.svg';
        break;
      case 'dark':
      default:
        svgPath = 'themes/dark.svg';
        break;
    }
    
    // Create and append the SVG element
    const svgElement = document.createElement('div');
    svgElement.className = 'theme-svg-container';
    svgElement.innerHTML = `<object type="image/svg+xml" data="${svgPath}" class="theme-svg"></object>`;
    
    backgroundContainer.appendChild(svgElement);
  }
  
  // Update theme controls UI
  updateThemeControls() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
      themeToggleBtn.setAttribute('aria-label', `Switch to ${this.currentTheme === 'dark' ? 'light' : 'dark'} theme`);
    }
  }
  
  // Listen for system theme preference changes
  listenForSystemThemeChanges() {
    // Check if browser supports prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // User prefers dark theme
      // We won't override their saved preference, but we could provide an option
    }
  }
  
  // Save current theme to localStorage
  saveToStorage() {
    try {
      localStorage.setItem('dajet-theme', this.currentTheme);
    } catch (error) {
      console.error('Failed to save theme to storage:', error);
    }
  }
  
  // Load theme from localStorage
  loadFromStorage() {
    try {
      const savedTheme = localStorage.getItem('dajet-theme');
      if (savedTheme && this.themes.includes(savedTheme)) {
        this.currentTheme = savedTheme;
      }
    } catch (error) {
      console.error('Failed to load theme from storage:', error);
    }
  }
  
  // Reset theme to default
  resetToDefault() {
    this.setTheme('dark');
  }
  
  // Check if a theme exists
  themeExists(themeName) {
    return this.themes.includes(themeName);
  }
  
  // Add a new theme (programmatically)
  addTheme(themeName) {
    if (!this.themes.includes(themeName)) {
      this.themes.push(themeName);
      return true;
    }
    return false;
  }
  
  // Remove a theme (cannot remove current theme)
  removeTheme(themeName) {
    if (themeName === this.currentTheme) {
      console.warn("Cannot remove current theme");
      return false;
    }
    
    const index = this.themes.indexOf(themeName);
    if (index > -1) {
      this.themes.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Extended theme manager with CSS variable support
class CssVariableThemeManager extends ThemeManager {
  constructor() {
    super();
    this.themeVariables = {
      dark: {
        '--bg-primary': '#0a0a0f',
        '--bg-secondary': '#12121a',
        '--text-primary': '#ffffff',
        '--text-secondary': '#a0a0b0',
        '--accent-primary': '#7c4dff',
        '--accent-secondary': '#00bcd4',
        '--glass-bg': 'rgba(255, 255, 255, 0.05)',
        '--glass-border': 'rgba(255, 255, 255, 0.1)'
      },
      lounge: {
        '--bg-primary': '#1a0f0a',
        '--bg-secondary': '#2a1810',
        '--text-primary': '#f5e6d3',
        '--text-secondary': '#c9b896',
        '--accent-primary': '#ff6b35',
        '--accent-secondary': '#ffb347',
        '--glass-bg': 'rgba(255, 180, 100, 0.08)',
        '--glass-border': 'rgba(255, 150, 80, 0.15)'
      }
    };
  }
  
  // Apply CSS variables for the theme
  applyCssVariables(themeName) {
    // Ensure themeVariables is properly initialized
    if (!this.themeVariables || !this.themeVariables[themeName]) {
      console.warn(`Theme variables for '${themeName}' not found`);
      return;
    }
    
    const themeVars = this.themeVariables[themeName];
    if (!themeVars) return;
    
    const root = document.documentElement;
    Object.entries(themeVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }
  
  // Override applyTheme to include CSS variables
  applyTheme(themeName) {
    if (!this.themes.includes(themeName)) {
      console.warn(`Theme '${themeName}' does not exist. Available themes: ${this.themes.join(', ')}`);
      return false;
    }
    
    // Apply CSS variables first
    this.applyCssVariables(themeName);
    
    // Then apply the regular theme
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Update internal state
    this.currentTheme = themeName;
    
    // Update any theme-dependent elements
    this.updateThemeDependentElements();
    
    // Notify listeners
    this.notifyThemeChange(themeName);
    
    return true;
  }
}