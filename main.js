/**
 * Main Application Entry Point
 * Initializes and orchestrates all components
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎵 DAJET Player initializing...');
  
  // 1. Initialize state
  const state = new PlayerState();
  state.load();
  
  // 2. Initialize theme manager
  const themeManager = new CssVariableThemeManager();
  themeManager.loadFromStorage();
  
  // 3. Initialize player
  const player = new DAJETPlayer();
  
  // 4. Initialize UI
  const ui = new UI(player, state);
  
  // 5. Initialize search
  const search = new Search();
  search.init(ALBUMS);
  
  // 6. Initialize visualizer
  const visualizer = new ThemedVisualizer(player.audio);
  visualizer.initCanvas();
  
  // 7. Initialize effects manager
  const effectsManager = new EffectsManager();
  effectsManager.registerEffect('strobe', new StrobeEffect());
  effectsManager.registerEffect('rays', new RaysEffect());
  
  // 8. Load and render albums
  ui.renderAlbumGrid(ALBUMS);
  
  // 9. Set up event listeners for player
  player.onTrackChange(track => {
    if (track) {
      ui.updatePlayerPanel(track);
      // Update visualizer when track changes
      if (visualizer.isEnabled) {
        visualizer.stop();
        visualizer.start(visualizer.type, visualizer.sensitivity);
      }
    }
  });
  
  player.onPlay(() => {
    state.update('isPlaying', true);
    ui.updatePlayButton(true);
  });
  
  player.onPause(() => {
    state.update('isPlaying', false);
    ui.updatePlayButton(false);
  });
  
  player.onEnd(() => {
    // Handle end of track
  });
  
  // 10. Set up theme change listener
  themeManager.onThemeChange(theme => {
    state.update('theme', theme);
    ui.updateThemeBackground(theme);
  });
  
  // 11. Initialize with first album if available
  if (ALBUMS.length > 0) {
    player.loadAlbum(ALBUMS[0].id);
  }
  
  // 12. Restore player state
  if (state.currentTrack) {
    // If there was a previously playing track, restore it
    player.loadAlbum(state.currentAlbum.id)
      .then(() => {
        // Find the track index in the loaded album
        const trackIndex = player.playlist.findIndex(t => t.file === state.currentTrack.file);
        if (trackIndex !== -1) {
          player.loadTrack(trackIndex);
          
          // If it was playing, resume playback
          if (state.isPlaying) {
            player.play();
          }
          
          // Restore time position
          if (state.currentTime > 0) {
            player.seek(state.currentTime);
          }
        }
      });
  }
  
  // 13. Set initial volume
  player.setVolume(state.volume);
  
  // 14. Log initialization complete
  console.log('🎵 DAJET Player initialized');
  console.log(`📋 Loaded ${ALBUMS.length} albums`);
  console.log(`🎨 Theme: ${themeManager.getCurrentTheme()}`);
  console.log(`🔊 Volume: ${Math.round(state.volume * 100)}%`);
});

// Handle page visibility changes to pause/resume audio appropriately
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden - we could pause audio here if needed
  } else {
    // Page is visible again
  }
});

// Handle beforeunload to save state
window.addEventListener('beforeunload', () => {
  // State is automatically saved when properties change,
  // but we might want to ensure it's saved one final time
});