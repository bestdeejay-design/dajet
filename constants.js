// Constants for the DAJET music player application

export const APP_CONFIG = {
  PLAYER_STATE_KEY: 'dajet-player-state',
  ALBUMS_STATE_KEY: 'dajet-albums-state',
  SETTINGS_KEY: 'dajet-settings',
  DEFAULT_VOLUME: 0.7,
  DEFAULT_THEME: 'dark',
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  MAX_PLAYLIST_SIZE: 1000,
  SEARCH_DEBOUNCE_TIME: 300,
};

export const THEMES = {
  DARK: 'dark',
  LOUNGE: 'lounge',
};

export const KEYS = {
  SPACEBAR: ' ',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
};

export const EVENTS = {
  TRACK_PLAY: 'trackPlay',
  TRACK_PAUSE: 'trackPause',
  TRACK_END: 'trackEnd',
  PLAYLIST_UPDATE: 'playlistUpdate',
  VOLUME_CHANGE: 'volumeChange',
  THEME_CHANGE: 'themeChange',
};