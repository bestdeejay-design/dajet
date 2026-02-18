/**
 * Effects Configuration Module
 * Defines settings for various visual effects
 */

const EFFECTS_CONFIG = {
  strobe: {
    enabled: false,
    frequency: 3, // Hz
    intensity: 0.15,
    colors: {
      dark: 'rgba(255, 255, 255, 0.15)',
      lounge: 'rgba(255, 120, 60, 0.2)'
    }
  },
  rays: {
    enabled: true,
    count: 12,
    speed: 0.5,
    colors: {
      dark: ['#7c4dff', '#00bcd4'],
      lounge: ['#ff6b35', '#ffb347']
    }
  },
  visualizer: {
    enabled: true,
    type: 'bars', // bars, waves, particles
    sensitivity: 0.8
  }
};

// Additional configuration for effects
const ADVANCED_EFFECTS_CONFIG = {
  particleSystem: {
    enabled: false,
    particleCount: 100,
    baseSize: 2,
    maxSize: 6,
    colors: {
      dark: ['#7c4dff', '#00bcd4', '#ffffff'],
      lounge: ['#ff6b35', '#ffb347', '#ffcc5c']
    }
  },
  ambientLighting: {
    enabled: true,
    intensity: 0.3,
    colors: {
      dark: ['#7c4dff', '#00bcd4'],
      lounge: ['#ff6b35', '#ffb347']
    }
  },
  audioReactive: {
    enabled: true,
    sensitivity: 0.7,
    smoothing: 0.85
  }
};