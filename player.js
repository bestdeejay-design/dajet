/**
 * Player Module
 * Handles audio playback functionality
 */

class Player {
  constructor() {
    this.audio = new Audio();
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 0.8;
    this.isMuted = false;
    
    // Set initial volume
    this.audio.volume = this.volume;
    
    // Bind event handlers
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Time update event
    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.updateProgress();
    });
    
    // Loaded metadata event (when duration becomes available)
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration;
      this.updateTotalTime();
    });
    
    // Ended event (when track finishes)
    this.audio.addEventListener('ended', () => {
      this.handleTrackEnd();
    });
    
    // Error event
    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
  }
  
  // Load a track
  loadTrack(src) {
    this.audio.src = src;
    this.audio.load();
    this.duration = 0; // Reset duration until metadata loads
  }
  
  // Play the current track
  play() {
    return this.audio.play()
      .then(() => {
        this.isPlaying = true;
        this.onPlay && this.onPlay();
      })
      .catch((error) => {
        console.error('Play failed:', error);
        this.isPlaying = false;
      });
  }
  
  // Pause the current track
  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.onPause && this.onPause();
  }
  
  // Stop playback
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.currentTime = 0;
    this.onPause && this.onPause();
  }
  
  // Seek to a specific time
  seek(time) {
    this.audio.currentTime = time;
    this.currentTime = time;
  }
  
  // Set volume
  setVolume(volume) {
    this.volume = volume;
    this.audio.volume = volume;
    this.isMuted = volume === 0;
  }
  
  // Mute/unmute
  toggleMute() {
    if (this.isMuted) {
      this.audio.volume = this.volume;
      this.isMuted = false;
    } else {
      this.audio.volume = 0;
      this.isMuted = true;
    }
  }
  
  // Get formatted time string (MM:SS)
  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Update progress bar
  updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.value = this.currentTime;
    }
    
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.currentTime);
    }
  }
  
  // Update total time display
  updateTotalTime() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.max = this.duration;
    }
    
    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(this.duration);
    }
  }
  
  // Handle track end
  handleTrackEnd() {
    this.isPlaying = false;
    this.onTrackEnd && this.onTrackEnd();
  }
  
  // Get current track info
  getCurrentTrackInfo() {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      isPlaying: this.isPlaying,
      volume: this.volume,
      isMuted: this.isMuted
    };
  }
}