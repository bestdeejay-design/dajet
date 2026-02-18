/**
 * UI Module
 * Manages the user interface and interactions
 */

class UI {
  constructor(player, state) {
    this.player = player;
    this.state = state;
    
    // DOM elements
    this.elements = {
      albumGrid: document.getElementById('album-grid'),
      albumView: document.getElementById('album-view'),
      playerPanel: document.getElementById('player-panel'),
      searchContainer: document.getElementById('search-container'),
      themeBackground: document.getElementById('theme-background'),
      strobeOverlay: document.getElementById('strobe-overlay'),
      currentTrackImage: document.getElementById('current-track-image'),
      currentTrackTitle: document.getElementById('current-track-title'),
      currentTrackArtist: document.getElementById('current-track-artist'),
      playBtn: document.getElementById('play-btn'),
      pauseBtn: document.getElementById('pause-btn'),
      nextBtn: document.getElementById('next-btn'),
      prevBtn: document.getElementById('prev-btn'),
      progressBar: document.getElementById('progress-bar'),
      currentTime: document.getElementById('current-time'),
      totalTime: document.getElementById('total-time'),
      volumeSlider: document.getElementById('volume-slider')
    };
    
    // Bind events
    this.bindEvents();
  }
  
  bindEvents() {
    // Player control events
    if (this.elements.playBtn) {
      this.elements.playBtn.addEventListener('click', () => {
        if (this.player.getCurrentTrack()) {
          this.player.play();
        } else if (this.player.playlist.length > 0) {
          this.player.loadTrack(0);
          this.player.play();
        }
      });
    }
    
    if (this.elements.pauseBtn) {
      this.elements.pauseBtn.addEventListener('click', () => {
        this.player.pause();
      });
    }
    
    if (this.elements.nextBtn) {
      this.elements.nextBtn.addEventListener('click', () => {
        this.player.next();
      });
    }
    
    if (this.elements.prevBtn) {
      this.elements.prevBtn.addEventListener('click', () => {
        this.player.prev();
      });
    }
    
    // Progress bar seeking
    if (this.elements.progressBar) {
      this.elements.progressBar.addEventListener('change', (e) => {
        this.player.seek(e.target.value);
      });
    }
    
    // Volume control
    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.addEventListener('input', (e) => {
        this.player.setVolume(parseFloat(e.target.value));
      });
    }
  }
  
  // Render album grid
  renderAlbumGrid(albums) {
    if (!this.elements.albumGrid) return;
    
    this.elements.albumGrid.innerHTML = '';
    
    albums.forEach(album => {
      const albumCard = document.createElement('div');
      albumCard.className = 'album-card';
      albumCard.dataset.albumId = album.id;
      
      albumCard.innerHTML = `
        <img src="${album.cover}" alt="${album.title}" class="album-cover">
        <div class="album-info">
          <h3>${album.title}</h3>
          <p>${album.trackCount} tracks</p>
        </div>
      `;
      
      albumCard.addEventListener('click', () => {
        this.showAlbum(album.id);
      });
      
      this.elements.albumGrid.appendChild(albumCard);
    });
  }
  
  // Show album tracks
  async showAlbum(albumId) {
    // Load the album
    await this.player.loadAlbum(albumId);
    
    // Switch to album view
    if (this.elements.albumGrid) {
      this.elements.albumGrid.style.display = 'none';
    }
    
    if (this.elements.albumView) {
      this.elements.albumView.style.display = 'block';
      
      const album = this.player.getCurrentAlbum();
      const tracks = this.player.playlist;
      
      this.elements.albumView.innerHTML = `
        <div class="album-header">
          <img src="${album.cover}" alt="${album.title}" class="album-cover-large">
          <div class="album-details">
            <h2>${album.title}</h2>
            <p>by BEST</p>
            <p>${album.trackCount} tracks</p>
          </div>
        </div>
        <div class="tracks-list">
          ${tracks.map((track, index) => `
            <div class="track-item" data-track-index="${index}">
              <span class="track-number">${(index + 1).toString().padStart(2, '0')}</span>
              <div class="track-info">
                <div class="title">${track.title}</div>
                <div class="artist">${track.artist}</div>
              </div>
              <div class="track-actions">
                <button class="play-track-btn">▶</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      // Add event listeners to track items
      document.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
          const trackIndex = parseInt(item.dataset.trackIndex);
          this.player.loadTrack(trackIndex);
          this.player.play();
        });
      });
    }
  }
  
  // Update player panel with current track info
  updatePlayerPanel(track) {
    if (!track) return;
    
    if (this.elements.currentTrackImage) {
      this.elements.currentTrackImage.src = track.cover || '';
    }
    
    if (this.elements.currentTrackTitle) {
      this.elements.currentTrackTitle.textContent = track.title;
    }
    
    if (this.elements.currentTrackArtist) {
      this.elements.currentTrackArtist.textContent = track.artist;
    }
  }
  
  // Update play/pause button state
  updatePlayButton(isPlaying) {
    if (!this.elements.playBtn || !this.elements.pauseBtn) return;
    
    if (isPlaying) {
      this.elements.playBtn.style.display = 'none';
      this.elements.pauseBtn.style.display = 'block';
    } else {
      this.elements.playBtn.style.display = 'block';
      this.elements.pauseBtn.style.display = 'none';
    }
  }
  
  // Update progress bar
  updateProgress(currentTime, duration) {
    if (this.elements.progressBar) {
      this.elements.progressBar.value = currentTime;
      this.elements.progressBar.max = duration;
    }
    
    if (this.elements.currentTime) {
      this.elements.currentTime.textContent = this.formatTime(currentTime);
    }
    
    if (this.elements.totalTime) {
      this.elements.totalTime.textContent = this.formatTime(duration);
    }
  }
  
  // Format time in MM:SS
  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Show/hide album grid
  showAlbumGrid(show = true) {
    if (this.elements.albumGrid) {
      this.elements.albumGrid.style.display = show ? 'grid' : 'none';
    }
  }
  
  // Show/hide album view
  showAlbumView(show = true) {
    if (this.elements.albumView) {
      this.elements.albumView.style.display = show ? 'block' : 'none';
    }
  }
  
  // Update theme background
  updateThemeBackground(theme) {
    if (this.elements.themeBackground) {
      // Remove existing theme classes
      this.elements.themeBackground.className = '';
      
      // Add new theme class
      this.elements.themeBackground.classList.add(`theme-${theme}`);
    }
  }
}