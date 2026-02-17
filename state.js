import { APP_CONFIG } from './constants.js';

/**
 * Centralized state management for the DAJET music player
 */
class StateManager {
  constructor() {
    this.state = {
      player: {
        currentTrack: null,
        isPlaying: false,
        volume: APP_CONFIG.DEFAULT_VOLUME,
        currentTime: 0,
        duration: 0,
      },
      playlist: [],
      albums: [],
      settings: {
        theme: APP_CONFIG.DEFAULT_THEME,
        shuffle: false,
        repeat: false,
      },
      search: {
        query: '',
        results: [],
      },
    };
    
    this.listeners = [];
    this.init();
  }

  /**
   * Initialize the state manager by loading saved state
   */
  init() {
    this.loadState();
    // Set up auto-save interval
    setInterval(() => {
      this.saveState();
    }, APP_CONFIG.AUTO_SAVE_INTERVAL);
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function to be called on state change
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers about state changes
   */
  notify() {
    // Create a deep copy of the state to prevent direct mutations
    const stateCopy = JSON.parse(JSON.stringify(this.state));
    this.listeners.forEach(listener => listener(stateCopy));
  }

  /**
   * Get current state
   * @returns {Object} Current application state
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update state with new values
   * @param {Object} newState - New state values to merge
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  /**
   * Update a specific part of the state
   * @param {string} module - Module name (e.g., 'player', 'playlist')
   * @param {Object} updates - Updates to apply to the module
   */
  updateModule(module, updates) {
    if (this.state.hasOwnProperty(module)) {
      this.state[module] = { ...this.state[module], ...updates };
      this.notify();
    }
  }

  /**
   * Load state from localStorage with validation
   */
  loadState() {
    try {
      // Load player state
      const playerState = localStorage.getItem(APP_CONFIG.PLAYER_STATE_KEY);
      if (playerState) {
        const parsedPlayerState = JSON.parse(playerState);
        if (this.isValidPlayerState(parsedPlayerState)) {
          this.state.player = { ...this.state.player, ...parsedPlayerState };
        }
      }

      // Load settings
      const settingsState = localStorage.getItem(APP_CONFIG.SETTINGS_KEY);
      if (settingsState) {
        const parsedSettingsState = JSON.parse(settingsState);
        if (this.isValidSettingsState(parsedSettingsState)) {
          this.state.settings = { ...this.state.settings, ...parsedSettingsState };
        }
      }

      // Load albums state
      const albumsState = localStorage.getItem(APP_CONFIG.ALBUMS_STATE_KEY);
      if (albumsState) {
        const parsedAlbumsState = JSON.parse(albumsState);
        if (this.isValidAlbumsState(parsedAlbumsState)) {
          this.state.albums = parsedAlbumsState;
        }
      }
    } catch (error) {
      console.error('Error loading state:', error);
      // Use default values if loading fails
      this.resetToDefaults();
    }
  }

  /**
   * Save current state to localStorage
   */
  saveState() {
    try {
      // Save player state
      localStorage.setItem(
        APP_CONFIG.PLAYER_STATE_KEY, 
        JSON.stringify(this.state.player)
      );

      // Save settings
      localStorage.setItem(
        APP_CONFIG.SETTINGS_KEY, 
        JSON.stringify(this.state.settings)
      );

      // Save albums state
      localStorage.setItem(
        APP_CONFIG.ALBUMS_STATE_KEY, 
        JSON.stringify(this.state.albums)
      );
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  /**
   * Validate player state object
   * @param {Object} state - Player state to validate
   * @returns {boolean} Whether the state is valid
   */
  isValidPlayerState(state) {
    if (!state || typeof state !== 'object') return false;
    
    // Check required properties and their types
    const checks = [
      state.currentTrack === null || typeof state.currentTrack === 'object',
      typeof state.isPlaying === 'boolean',
      typeof state.volume === 'number' && state.volume >= 0 && state.volume <= 1,
      typeof state.currentTime === 'number' && state.currentTime >= 0,
      typeof state.duration === 'number' && state.duration >= 0
    ];
    
    return checks.every(check => check === true);
  }

  /**
   * Validate settings state object
   * @param {Object} state - Settings state to validate
   * @returns {boolean} Whether the state is valid
   */
  isValidSettingsState(state) {
    if (!state || typeof state !== 'object') return false;
    
    const checks = [
      typeof state.theme === 'string',
      typeof state.shuffle === 'boolean',
      typeof state.repeat === 'boolean'
    ];
    
    return checks.every(check => check === true);
  }

  /**
   * Validate albums state object
   * @param {Object} state - Albums state to validate
   * @returns {boolean} Whether the state is valid
   */
  isValidAlbumsState(state) {
    if (!Array.isArray(state)) return false;
    
    // Additional validation could be added here
    return true;
  }

  /**
   * Reset state to default values
   */
  resetToDefaults() {
    this.state = {
      player: {
        currentTrack: null,
        isPlaying: false,
        volume: APP_CONFIG.DEFAULT_VOLUME,
        currentTime: 0,
        duration: 0,
      },
      playlist: [],
      albums: [],
      settings: {
        theme: APP_CONFIG.DEFAULT_THEME,
        shuffle: false,
        repeat: false,
      },
      search: {
        query: '',
        results: [],
      },
    };
  }

  /**
   * Clear all saved state
   */
  clearState() {
    try {
      localStorage.removeItem(APP_CONFIG.PLAYER_STATE_KEY);
      localStorage.removeItem(APP_CONFIG.SETTINGS_KEY);
      localStorage.removeItem(APP_CONFIG.ALBUMS_STATE_KEY);
      
      this.resetToDefaults();
      this.notify();
    } catch (error) {
      console.error('Error clearing state:', error);
    }
  }
}

// Export singleton instance
const stateManager = new StateManager();
export default stateManager;