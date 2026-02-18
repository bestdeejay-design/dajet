/**
 * Rays/Lighting Effects Module
 * Creates animated ray effects synchronized with music
 */

class RaysEffect {
  constructor() {
    this.isEnabled = false;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.rayCount = 12;
    this.speed = 0.5;
    this.colors = ['#7c4dff', '#00bcd4'];
    this.angleOffset = 0;
    
    // Check if we're in a browser environment
    if (typeof document !== 'undefined') {
      this.initCanvas();
    }
  }

  // Initialize canvas for ray effects
  initCanvas() {
    // Create overlay canvas for rays
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'rays-overlay';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '998';
    this.canvas.style.opacity = '0.3';

    // Add to body if it exists
    if (document.body) {
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    } else {
      console.warn('⚠️ #rays-overlay not found – световые лучи не инициализированы');
    }
  }

  // Resize canvas to match window
  resizeCanvas() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  // Enable the effect
  enable() {
    if (!this.isEnabled) {
      this.isEnabled = true;
      this.animate();
    }
  }

  // Disable the effect
  disable() {
    if (this.isEnabled) {
      this.isEnabled = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }
  }

  // Toggle the effect
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  // Animation loop
  animate() {
    if (!this.isEnabled || !this.ctx) return;

    this.animationId = requestAnimationFrame(() => this.animate());
    this.drawRays();
  }

  // Draw the ray effect
  drawRays() {
    if (!this.ctx || !this.canvas) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Update angle offset for animation
    this.angleOffset += 0.005 * this.speed;
    
    // Draw rays from center outward
    for (let i = 0; i < this.rayCount; i++) {
      const angle = (i / this.rayCount) * Math.PI * 2 + this.angleOffset;
      
      // Calculate start and end points
      const startX = centerX + Math.cos(angle) * 50;
      const startY = centerY + Math.sin(angle) * 50;
      
      const endX = centerX + Math.cos(angle) * this.canvas.width;
      const endY = centerY + Math.sin(angle) * this.canvas.height;
      
      // Create gradient for the ray
      const gradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
      const colorIndex = i % this.colors.length;
      
      gradient.addColorStop(0, this.colors[colorIndex]);
      gradient.addColorStop(0.7, this.colors[colorIndex] + '80'); // 50% opacity
      gradient.addColorStop(1, this.colors[colorIndex] + '00'); // Transparent
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 8;
      this.ctx.stroke();
    }
  }

  // Update ray properties
  updateProperties(rayCount, speed, colors) {
    if (rayCount !== undefined) this.rayCount = rayCount;
    if (speed !== undefined) this.speed = speed;
    if (colors !== undefined) this.colors = colors;
  }

  // Update method called by effects manager
  update() {
    // In this case, animation is continuous when enabled
    // But we could sync with audio here if needed
  }

  // Set theme-specific colors
  setThemeColors(theme) {
    if (theme === 'lounge') {
      this.colors = ['#ff6b35', '#ffb347'];
    } else {
      // Default to dark theme colors
      this.colors = ['#7c4dff', '#00bcd4'];
    }
  }
}

// Extended version with audio synchronization
class AudioSynchronizedRaysEffect extends RaysEffect {
  constructor(audioElement) {
    super();
    this.audioElement = audioElement;
    this.analyser = null;
    
    // Initialize audio analysis if audio element is provided
    if (this.audioElement && typeof window.AudioContext !== 'undefined') {
      this.initAudioAnalysis();
    }
  }

  initAudioAnalysis() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(this.audioElement);
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      
      source.connect(this.analyser);
      this.analyser.connect(audioContext.destination);
    } catch (error) {
      console.warn('Audio synchronization not available:', error);
    }
  }

  // Override drawRays to sync with audio
  drawRays() {
    if (!this.ctx || !this.canvas) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Update angle offset for animation
    this.angleOffset += 0.005 * this.speed;
    
    // Get audio data if available
    let audioIntensity = 1;
    if (this.analyser) {
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average intensity
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      audioIntensity = 0.5 + (sum / dataArray.length) / 255 * 0.5; // Range 0.5 to 1.0
    }
    
    // Draw rays from center outward
    for (let i = 0; i < this.rayCount; i++) {
      const angle = (i / this.rayCount) * Math.PI * 2 + this.angleOffset;
      
      // Calculate start and end points with audio intensity
      const startX = centerX + Math.cos(angle) * 50;
      const startY = centerY + Math.sin(angle) * 50;
      
      const endX = centerX + Math.cos(angle) * (this.canvas.width * audioIntensity);
      const endY = centerY + Math.sin(angle) * (this.canvas.height * audioIntensity);
      
      // Create gradient for the ray
      const gradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
      const colorIndex = i % this.colors.length;
      
      gradient.addColorStop(0, this.colors[colorIndex]);
      gradient.addColorStop(0.7, this.colors[colorIndex] + '80'); // 50% opacity
      gradient.addColorStop(1, this.colors[colorIndex] + '00'); // Transparent
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 8 * audioIntensity; // Vary line width with audio
      this.ctx.stroke();
    }
  }
}