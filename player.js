import { APP_CONFIG, EVENTS } from './constants.js';

/**
 * Player class to handle audio playback functionality
 */
class Player {
  constructor() {
    this.audio = new Audio();
    this.currentTrack = null;
    this.isPlaying = false;
    this.volume = APP_CONFIG.DEFAULT_VOLUME;
    this.currentTime = 0;
    this.duration = 0;
    
    this.setupEventListeners();
    this.loadState();
  }

  /**
   * Set up event listeners for the audio element
   */
  setupEventListeners() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.dispatchCustomEvent(EVENTS.TRACK_PLAY);
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.dispatchCustomEvent(EVENTS.TRACK_PAUSE);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.dispatchCustomEvent(EVENTS.TRACK_END);
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.duration = this.audio.duration || 0;
    });

    this.audio.addEventListener('volumechange', () => {
      this.volume = this.audio.volume;
    });
  }

  /**
   * Dispatch custom events for other modules to listen to
   * @param {string} eventName - Name of the event
   * @param {Object} detail - Event details
   */
  dispatchCustomEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Load player state from localStorage
   */
  loadState() {
    try {
      const savedState = localStorage.getItem(APP_CONFIG.PLAYER_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state && typeof state === 'object') {
          this.volume = state.volume !== undefined ? state.volume : APP_CONFIG.DEFAULT_VOLUME;
          this.audio.volume = this.volume;
        }
      }
    } catch (error) {
      console.warn('Failed to load player state:', error);
    }
  }

  /**
   * Save player state to localStorage
   */
  saveState() {
    try {
      const state = {
        volume: this.volume,
        currentTime: this.currentTime,
      };
      localStorage.setItem(APP_CONFIG.PLAYER_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save player state:', error);
    }
  }

  /**
   * Play a track
   * @param {string} src - Source URL of the track
   * @param {Object} trackInfo - Information about the track
   */
  playTrack(src, trackInfo = {}) {
    try {
      if (this.audio.src !== src) {
        this.audio.src = src;
      }
      
      this.currentTrack = trackInfo;
      this.audio.play().catch(error => {
        console.error('Error playing track:', error);
      });
    } catch (error) {
      console.error('Error setting up track:', error);
    }
  }

  /**
   * Pause current track
   */
  pauseTrack() {
    try {
      this.audio.pause();
    } catch (error) {
      console.error('Error pausing track:', error);
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (this.isPlaying) {
      this.pauseTrack();
    } else {
      if (this.currentTrack) {
        this.audio.play().catch(error => {
          console.error('Error resuming track:', error);
        });
      }
    }
  }

  /**
   * Seek to a specific time in the track
   * @param {number} time - Time in seconds
   */
  seekTo(time) {
    try {
      this.audio.currentTime = time;
    } catch (error) {
      console.error('Error seeking to time:', error);
    }
  }

  /**
   * Set volume
   * @param {number} volume - Volume level between 0 and 1
   */
  setVolume(volume) {
    try {
      this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
      this.audio.volume = this.volume;
      this.dispatchCustomEvent(EVENTS.VOLUME_CHANGE, { volume: this.volume });
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  /**
   * Get formatted time string
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string (MM:SS)
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  /**
   * Get current playback progress percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress() {
    if (this.duration > 0) {
      return (this.currentTime / this.duration) * 100;
    }
    return 0;
  }
}

// Export singleton instance
const player = new Player();
export default player;