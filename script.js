/**
 * DAJET Music Player Class
 * Main player logic implementation
 */

class DAJETPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentAlbum = null;
    this.currentTrackIndex = 0;
    this.playlist = [];
    this.repeatMode = 'all'; // 'all', 'one', 'off'
    this.shuffle = false;
    this.state = new PlayerState();
    
    // Event callbacks
    this.onTrackChangeCallbacks = [];
    this.onPlayCallbacks = [];
    this.onPauseCallbacks = [];
    this.onEndCallbacks = [];
    
    // Initialize audio event listeners
    this._setupAudioEvents();
  }
  
  _setupAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      this.state.currentTime = this.audio.currentTime;
      this.updateProgress();
    });
    
    this.audio.addEventListener('ended', () => {
      this.handleTrackEnd();
    });
    
    this.audio.addEventListener('loadedmetadata', () => {
      this.updateTotalTime();
    });
  }
  
  // Load an album and its tracks
  async loadAlbum(albumId) {
    const album = ALBUMS.find(a => a.id === albumId);
    if (!album) {
      console.error(`Album with ID ${albumId} not found`);
      return false;
    }
    
    try {
      // Dynamically import the album's track data
      const albumModule = await import(album.tracksFile);
      this.currentAlbum = album;
      this.playlist = [...albumModule.ALBUM_TRACKS];
      
      // Update state
      this.state.currentAlbum = album;
      this.state.save();
      
      // Notify listeners
      this.onTrackChangeCallbacks.forEach(cb => cb(this.getCurrentTrack()));
      
      return true;
    } catch (error) {
      console.error(`Error loading album ${albumId}:`, error);
      return false;
    }
  }
  
  // Load a specific track by index
  loadTrack(trackIndex) {
    if (trackIndex < 0 || trackIndex >= this.playlist.length) {
      console.error(`Invalid track index: ${trackIndex}`);
      return false;
    }
    
    this.currentTrackIndex = trackIndex;
    const track = this.playlist[trackIndex];
    
    this.audio.src = track.file;
    this.audio.load();
    
    // Update state
    this.state.currentTrack = track;
    this.state.save();
    
    // Notify listeners
    this.onTrackChangeCallbacks.forEach(cb => cb(track));
    
    return true;
  }
  
  // Play the current track
  play() {
    this.audio.play()
      .then(() => {
        this.state.isPlaying = true;
        this.state.save();
        this.onPlayCallbacks.forEach(cb => cb());
      })
      .catch(error => {
        console.error('Play failed:', error);
      });
  }
  
  // Pause the current track
  pause() {
    this.audio.pause();
    this.state.isPlaying = false;
    this.state.save();
    this.onPauseCallbacks.forEach(cb => cb());
  }
  
  // Stop playback
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.state.save();
    this.onPauseCallbacks.forEach(cb => cb());
  }
  
  // Play next track
  next() {
    if (this.playlist.length === 0) return;
    
    if (this.shuffle) {
      // Pick random track
      const randomIndex = Math.floor(Math.random() * this.playlist.length);
      this.loadTrack(randomIndex);
    } else {
      let nextIndex;
      
      switch (this.repeatMode) {
        case 'one':
          nextIndex = this.currentTrackIndex;
          break;
        case 'all':
          nextIndex = (this.currentTrackIndex + 1) % this.playlist.length;
          break;
        case 'off':
        default:
          nextIndex = this.currentTrackIndex + 1;
          if (nextIndex >= this.playlist.length) {
            this.stop();
            return;
          }
          break;
      }
      
      this.loadTrack(nextIndex);
    }
    
    if (this.state.isPlaying) {
      this.play();
    }
  }
  
  // Play previous track
  prev() {
    if (this.playlist.length === 0) return;
    
    let prevIndex;
    
    if (this.audio.currentTime > 3) {
      // If more than 3 seconds into track, restart current track
      prevIndex = this.currentTrackIndex;
    } else {
      // Otherwise go to previous track
      prevIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    }
    
    this.loadTrack(prevIndex);
    
    if (this.state.isPlaying) {
      this.play();
    }
  }
  
  // Seek to a specific time
  seek(time) {
    this.audio.currentTime = time;
    this.state.currentTime = time;
    this.state.save();
  }
  
  // Set volume
  setVolume(volume) {
    this.audio.volume = volume;
    this.state.volume = volume;
    this.state.save();
  }
  
  // Set repeat mode
  setRepeatMode(mode) {
    if (['all', 'one', 'off'].includes(mode)) {
      this.repeatMode = mode;
      this.state.repeatMode = mode;
      this.state.save();
    }
  }
  
  // Toggle shuffle
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.state.shuffle = this.shuffle;
    this.state.save();
  }
  
  // Handle track end based on repeat/shuffle settings
  handleTrackEnd() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this.next();
    }
    
    this.onEndCallbacks.forEach(cb => cb());
  }
  
  // Update progress bar
  updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.value = this.audio.currentTime;
    }
    
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }
  }
  
  // Update total time display
  updateTotalTime() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.max = this.audio.duration;
    }
    
    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(this.audio.duration);
    }
  }
  
  // Format time in MM:SS
  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Get current track info
  getCurrentTrack() {
    if (this.playlist.length === 0 || this.currentTrackIndex < 0) return null;
    return this.playlist[this.currentTrackIndex];
  }
  
  // Get current album info
  getCurrentAlbum() {
    return this.currentAlbum;
  }
  
  // Event subscription methods
  onTrackChange(callback) {
    this.onTrackChangeCallbacks.push(callback);
  }
  
  onPlay(callback) {
    this.onPlayCallbacks.push(callback);
  }
  
  onPause(callback) {
    this.onPauseCallbacks.push(callback);
  }
  
  onEnd(callback) {
    this.onEndCallbacks.push(callback);
  }
}