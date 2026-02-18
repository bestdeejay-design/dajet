/**
 * State Management Module
 * Handles application state persistence and synchronization
 */

class PlayerState {
  constructor() {
    this.currentTrack = null;
    this.isPlaying = false;
    this.volume = 0.8;
    this.currentTime = 0;
    this.currentAlbum = null;
    this.theme = 'dark';
    this.strobeEnabled = false;
    this.repeatMode = 'all';
    this.shuffle = false;
    
    // Load saved state from localStorage
    this.load();
  }
  
  // Save current state to localStorage
  save() {
    try {
      const state = {
        currentTrack: this.currentTrack,
        isPlaying: this.isPlaying,
        volume: this.volume,
        currentTime: this.currentTime,
        currentAlbum: this.currentAlbum,
        theme: this.theme,
        strobeEnabled: this.strobeEnabled,
        repeatMode: this.repeatMode,
        shuffle: this.shuffle
      };
      
      localStorage.setItem('dajet-player-state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }
  
  // Load state from localStorage
  load() {
    try {
      const savedState = localStorage.getItem('dajet-player-state');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Only update properties that exist in our state
        Object.keys(parsedState).forEach(key => {
          if (this.hasOwnProperty(key)) {
            this[key] = parsedState[key];
          }
        });
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }
  
  // Reset state to defaults
  reset() {
    this.currentTrack = null;
    this.isPlaying = false;
    this.volume = 0.8;
    this.currentTime = 0;
    this.currentAlbum = null;
    this.theme = 'dark';
    this.strobeEnabled = false;
    this.repeatMode = 'all';
    this.shuffle = false;
    
    this.save();
  }
  
  // Update a specific property and save
  update(property, value) {
    if (this.hasOwnProperty(property)) {
      this[property] = value;
      this.save();
    }
  }
  
  // Get a specific property value
  get(property) {
    return this.hasOwnProperty(property) ? this[property] : undefined;
  }
  
  // Toggle boolean properties
  toggle(property) {
    if (this.hasOwnProperty(property) && typeof this[property] === 'boolean') {
      this[property] = !this[property];
      this.save();
      return this[property];
    }
    return undefined;
  }
  
  // Batch update multiple properties
  batchUpdate(updates) {
    let changed = false;
    
    Object.keys(updates).forEach(key => {
      if (this.hasOwnProperty(key)) {
        this[key] = updates[key];
        changed = true;
      }
    });
    
    if (changed) {
      this.save();
    }
  }
  
  // Get all state as a plain object
  getAll() {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      volume: this.volume,
      currentTime: this.currentTime,
      currentAlbum: this.currentAlbum,
      theme: this.theme,
      strobeEnabled: this.strobeEnabled,
      repeatMode: this.repeatMode,
      shuffle: this.shuffle
    };
  }
}

// Reactive state manager for UI synchronization
class ReactiveStateManager extends PlayerState {
  constructor() {
    super();
    this.listeners = {};
  }
  
  // Subscribe to state changes
  subscribe(property, callback) {
    if (!this.listeners[property]) {
      this.listeners[property] = [];
    }
    
    this.listeners[property].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[property] = this.listeners[property].filter(
        listener => listener !== callback
      );
    };
  }
  
  // Update property and notify listeners
  update(property, value) {
    if (this.hasOwnProperty(property)) {
      const oldValue = this[property];
      this[property] = value;
      
      // Notify listeners if value changed
      if (oldValue !== value && this.listeners[property]) {
        this.listeners[property].forEach(callback => {
          callback(value, oldValue);
        });
      }
      
      this.save();
    }
  }
  
  // Notify listeners without changing value
  notify(property) {
    if (this.listeners[property]) {
      this.listeners[property].forEach(callback => {
        callback(this[property]);
      });
    }
  }
}