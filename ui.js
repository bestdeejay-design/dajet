import player from './player.js';
import { APP_CONFIG, THEMES, KEYS } from './constants.js';

/**
 * UI class to handle user interface interactions
 */
class UI {
  constructor() {
    this.elements = {};
    this.currentScreen = 'main';
    this.init();
  }

  /**
   * Initialize the UI components
   */
  init() {
    this.getElements();
    this.bindEvents();
    this.loadTheme();
    this.updateAccessibilityAttributes();
  }

  /**
   * Get references to DOM elements
   */
  getElements() {
    this.elements = {
      // Player controls
      playButton: document.getElementById('play-btn'),
      prevButton: document.getElementById('prev-btn'),
      nextButton: document.getElementById('next-btn'),
      volumeSlider: document.getElementById('volume-slider'),
      progressBar: document.getElementById('progress-bar'),
      currentTime: document.getElementById('current-time'),
      totalTime: document.getElementById('total-time'),
      trackTitle: document.getElementById('track-title'),
      trackArtist: document.getElementById('track-artist'),
      
      // Theme controls
      themeToggle: document.getElementById('theme-toggle'),
      
      // Main containers
      mainContainer: document.querySelector('.container'),
      playerControls: document.querySelector('.player-controls'),
      playlistContainer: document.getElementById('playlist-container'),
      
      // Loading indicators
      loadingSpinner: document.querySelector('.loading-spinner'),
      
      // Screen elements
      mainScreen: document.getElementById('main-screen'),
      albumScreen: document.getElementById('album-screen'),
      searchScreen: document.getElementById('search-screen'),
    };
  }

  /**
   * Bind event listeners to UI elements
   */
  bindEvents() {
    // Player controls
    if (this.elements.playButton) {
      this.elements.playButton.addEventListener('click', () => player.togglePlayPause());
    }
    
    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.addEventListener('input', (e) => {
        player.setVolume(parseFloat(e.target.value));
      });
    }
    
    if (this.elements.progressBar) {
      this.elements.progressBar.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value);
        const newTime = (percent / 100) * player.duration;
        player.seekTo(newTime);
      });
    }
    
    // Theme toggle
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    // Listen to player events
    document.addEventListener('trackPlay', () => this.updatePlayButton(true));
    document.addEventListener('trackPause', () => this.updatePlayButton(false));
    document.addEventListener('trackEnd', () => this.handleTrackEnd());
    document.addEventListener('volumeChange', (e) => this.updateVolumeSlider(e.detail.volume));
  }

  /**
   * Update accessibility attributes for better screen reader support
   */
  updateAccessibilityAttributes() {
    // Add ARIA labels to buttons
    if (this.elements.playButton) {
      this.elements.playButton.setAttribute('aria-label', 'Play/Pause');
      this.elements.playButton.setAttribute('role', 'button');
    }
    
    if (this.elements.prevButton) {
      this.elements.prevButton.setAttribute('aria-label', 'Previous Track');
      this.elements.prevButton.setAttribute('role', 'button');
    }
    
    if (this.elements.nextButton) {
      this.elements.nextButton.setAttribute('aria-label', 'Next Track');
      this.elements.nextButton.setAttribute('role', 'button');
    }
    
    // Add keyboard navigation support
    const focusableElements = [
      this.elements.playButton,
      this.elements.prevButton,
      this.elements.nextButton,
      this.elements.volumeSlider,
      this.elements.progressBar
    ];
    
    focusableElements.forEach((element, index) => {
      if (element) {
        element.setAttribute('tabindex', '0');
      }
    });
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    switch (e.key) {
      case KEYS.SPACEBAR:
        e.preventDefault();
        player.togglePlayPause();
        break;
        
      case KEYS.ARROW_LEFT:
        e.preventDefault();
        // Implement seeking backward
        player.seekTo(Math.max(0, player.currentTime - 10));
        break;
        
      case KEYS.ARROW_RIGHT:
        e.preventDefault();
        // Implement seeking forward
        player.seekTo(Math.min(player.duration, player.currentTime + 10));
        break;
        
      case KEYS.ARROW_UP:
        e.preventDefault();
        // Increase volume
        player.setVolume(Math.min(1, player.volume + 0.1));
        break;
        
      case KEYS.ARROW_DOWN:
        e.preventDefault();
        // Decrease volume
        player.setVolume(Math.max(0, player.volume - 0.1));
        break;
    }
  }

  /**
   * Update the play button appearance based on playback state
   * @param {boolean} isPlaying - Whether the player is currently playing
   */
  updatePlayButton(isPlaying) {
    if (this.elements.playButton) {
      this.elements.playButton.textContent = isPlaying ? '⏸️' : '▶️';
      this.elements.playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }
  }

  /**
   * Update the volume slider position
   * @param {number} volume - Current volume level
   */
  updateVolumeSlider(volume) {
    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.value = volume;
    }
  }

  /**
   * Update track information display
   * @param {Object} trackInfo - Information about the current track
   */
  updateTrackInfo(trackInfo) {
    if (this.elements.trackTitle) {
      this.elements.trackTitle.textContent = trackInfo.title || 'Unknown Title';
      this.elements.trackTitle.setAttribute('aria-label', `Now playing: ${trackInfo.title || 'Unknown Title'}`);
    }
    
    if (this.elements.trackArtist) {
      this.elements.trackArtist.textContent = trackInfo.artist || 'Unknown Artist';
    }
  }

  /**
   * Update progress bar and time displays
   */
  updateProgress() {
    if (this.elements.progressBar && !isNaN(player.duration)) {
      const progress = player.getProgress();
      this.elements.progressBar.value = progress;
    }
    
    if (this.elements.currentTime) {
      this.elements.currentTime.textContent = player.formatTime(player.currentTime);
    }
    
    if (this.elements.totalTime) {
      this.elements.totalTime.textContent = player.formatTime(player.duration);
    }
  }

  /**
   * Show/hide loading spinner
   * @param {boolean} show - Whether to show the spinner
   */
  setLoading(show) {
    if (this.elements.loadingSpinner) {
      this.elements.loadingSpinner.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Load and apply the saved theme
   */
  loadTheme() {
    try {
      const savedTheme = localStorage.getItem(APP_CONFIG.SETTINGS_KEY);
      let theme = APP_CONFIG.DEFAULT_THEME;
      
      if (savedTheme) {
        const settings = JSON.parse(savedTheme);
        theme = settings.theme || APP_CONFIG.DEFAULT_THEME;
      }
      
      this.applyTheme(theme);
    } catch (error) {
      console.warn('Failed to load theme:', error);
      this.applyTheme(APP_CONFIG.DEFAULT_THEME);
    }
  }

  /**
   * Apply a theme to the application
   * @param {string} themeName - Name of the theme to apply
   */
  applyTheme(themeName) {
    document.body.className = '';
    document.body.classList.add(`theme-${themeName}`);
    
    // Update theme toggle button
    if (this.elements.themeToggle) {
      this.elements.themeToggle.textContent = themeName === THEMES.DARK ? '🌙' : '☀️';
      this.elements.themeToggle.setAttribute('aria-label', 
        themeName === THEMES.DARK ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
  }

  /**
   * Toggle between themes
   */
  toggleTheme() {
    const currentTheme = document.body.classList.contains(`theme-${THEMES.DARK}`) 
      ? THEMES.LOUNGE 
      : THEMES.DARK;
    
    this.applyTheme(currentTheme);
    
    // Save theme preference
    try {
      const settings = {
        theme: currentTheme,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(APP_CONFIG.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }

  /**
   * Handle track end event
   */
  handleTrackEnd() {
    // Could implement auto-play next track here
  }

  /**
   * Update UI based on current playback state
   */
  updateUI() {
    this.updateProgress();
  }
}

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ui = new UI();
});

export default UI;