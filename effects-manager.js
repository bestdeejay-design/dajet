/** 
 * Effects Manager Module
 * Orchestrates all visual effects
 */

class EffectsManager {
  constructor() {
    this.effects = {};
    this.enabled = true;
  }

  // Register a new effect
  registerEffect(name, effect) {
    this.effects[name] = effect;
  }

  // Enable a specific effect
  enableEffect(name) {
    if (this.effects[name] && typeof this.effects[name].enable === 'function') {
      this.effects[name].enable();
    }
  }

  // Disable a specific effect
  disableEffect(name) {
    if (this.effects[name] && typeof this.effects[name].disable === 'function') {
      this.effects[name].disable();
    }
  }

  // Toggle an effect on/off
  toggleEffect(name) {
    if (this.effects[name] && typeof this.effects[name].toggle === 'function') {
      this.effects[name].toggle();
    }
  }

  // Update all enabled effects
  update() {
    Object.values(this.effects).forEach(effect => {
      if (effect.isEnabled && typeof effect.update === 'function') {
        effect.update();
      }
    });
  }

  // Enable all effects
  enableAll() {
    Object.values(this.effects).forEach(effect => {
      if (typeof effect.enable === 'function') {
        effect.enable();
      }
    });
    this.enabled = true;
  }

  // Disable all effects
  disableAll() {
    Object.values(this.effects).forEach(effect => {
      if (typeof effect.disable === 'function') {
        effect.disable();
      }
    });
    this.enabled = false;
  }

  // Get effect by name
  getEffect(name) {
    return this.effects[name];
  }

  // Check if an effect is registered
  hasEffect(name) {
    return this.effects.hasOwnProperty(name);
  }

  // Remove an effect
  removeEffect(name) {
    if (this.effects[name]) {
      delete this.effects[name];
    }
  }

  // Get all effect names
  getEffectNames() {
    return Object.keys(this.effects);
  }
}