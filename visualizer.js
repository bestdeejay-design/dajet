/**
 * Audio Visualizer Module
 * Creates visual representations of audio data
 */

class Visualizer {
  constructor(audioElement) {
    this.audio = audioElement;
    this.canvas = null;
    this.ctx = null;
    this.analyser = null;
    this.dataArray = null;
    this.animationId = null;
    this.isEnabled = false;
    this.type = 'bars'; // 'bars', 'waves', 'particles'
    this.sensitivity = 0.8;
    
    // Initialize Web Audio API components
    this.initAudioContext();
  }
  
  // Initialize Web Audio API
  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      // Connect audio element to analyser
      const source = this.audioContext.createMediaElementSource(this.audio);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      // Configure analyser
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
    } catch (error) {
      console.error('Web Audio API not supported:', error);
    }
  }
  
  // Initialize canvas for visualization
  initCanvas(containerId = 'visualizer-canvas') {
    if (!this.analyser) return false;
    
    // Create or get canvas element
    this.canvas = document.getElementById(containerId);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = containerId;
      this.canvas.className = 'visualizer-canvas';
      
      // Add to page
      const container = document.body;
      container.appendChild(this.canvas);
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size to match window
    this.resizeCanvas();
    
    // Listen for window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    
    return true;
  }
  
  // Resize canvas to match window
  resizeCanvas() {
    if (!this.canvas) return;
    
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - 100; // Account for player controls
  }
  
  // Start visualization
  start(type = 'bars', sensitivity = 0.8) {
    if (!this.analyser || !this.ctx) {
      console.error('Cannot start visualizer: not properly initialized');
      return false;
    }
    
    this.type = type;
    this.sensitivity = sensitivity;
    this.isEnabled = true;
    
    // Begin animation loop
    this.animate();
    
    return true;
  }
  
  // Stop visualization
  stop() {
    this.isEnabled = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  // Animation loop
  animate() {
    if (!this.isEnabled || !this.analyser) return;
    
    // Request next frame
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw visualization based on type
    switch (this.type) {
      case 'bars':
        this.drawBars();
        break;
      case 'waves':
        this.drawWaves();
        break;
      case 'particles':
        this.drawParticles();
        break;
      default:
        this.drawBars(); // fallback to bars
    }
  }
  
  // Draw bar visualization
  drawBars() {
    const barWidth = (this.canvas.width / this.dataArray.length) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < this.dataArray.length; i++) {
      barHeight = (this.dataArray[i] / 255) * this.canvas.height * this.sensitivity;
      
      // Determine color based on theme
      const color = this.getThemeColor(i);
      
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }
  
  // Draw wave visualization
  drawWaves() {
    this.ctx.beginPath();
    
    const sliceWidth = this.canvas.width * 1.0 / this.dataArray.length;
    let x = 0;
    
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = v * this.canvas.height / 2.0;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = this.getThemeColor(0);
    this.ctx.stroke();
  }
  
  // Draw particle visualization
  drawParticles() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;
    
    for (let i = 0; i < this.dataArray.length; i++) {
      const amplitude = this.dataArray[i] / 255;
      const angle = (i / this.dataArray.length) * Math.PI * 2;
      
      const x = centerX + Math.cos(angle) * radius * (1 + amplitude * this.sensitivity);
      const y = centerY + Math.sin(angle) * radius * (1 + amplitude * this.sensitivity);
      
      const size = amplitude * 5;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = this.getThemeColor(i);
      this.ctx.fill();
    }
  }
  
  // Get color based on current theme
  getThemeColor(index) {
    // Check if dark theme is active
    const isDarkTheme = document.documentElement.getAttribute('data-theme') !== 'lounge';
    
    if (isDarkTheme) {
      // Dark theme colors
      const hue = (index * 1.5) % 360;
      return `hsla(${hue}, 80%, 60%, 0.7)`;
    } else {
      // Lounge theme colors
      const hue = 20 + (index * 0.5) % 40; // Warm tones: orange, amber
      return `hsla(${hue}, 70%, 50%, 0.7)`;
    }
  }
  
  // Update visualization type
  setType(type) {
    if (['bars', 'waves', 'particles'].includes(type)) {
      this.type = type;
    }
  }
  
  // Update sensitivity
  setSensitivity(sensitivity) {
    this.sensitivity = Math.max(0.1, Math.min(2.0, sensitivity));
  }
  
  // Toggle visualization
  toggle() {
    if (this.isEnabled) {
      this.stop();
    } else {
      this.start(this.type, this.sensitivity);
    }
  }
  
  // Get current status
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      type: this.type,
      sensitivity: this.sensitivity
    };
  }
}

// Enhanced visualizer with theme integration
class ThemedVisualizer extends Visualizer {
  constructor(audioElement) {
    super(audioElement);
    this.themeColors = {
      dark: {
        primary: '#7c4dff',
        secondary: '#00bcd4',
        accent: '#ff4081'
      },
      lounge: {
        primary: '#ff6b35',
        secondary: '#ffb347',
        accent: '#ffcc5c'
      }
    };
  }
  
  // Override color method to use theme colors
  getThemeColor(index) {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const colors = this.themeColors[theme] || this.themeColors.dark;
    
    // Calculate position in frequency spectrum
    const position = index / this.dataArray.length;
    
    // Select color based on position and frequency value
    let color;
    if (position < 0.33) {
      color = colors.primary;
    } else if (position < 0.66) {
      color = colors.secondary;
    } else {
      color = colors.accent;
    }
    
    // Adjust opacity based on amplitude
    const amplitude = this.dataArray[index] / 255;
    const alpha = 0.3 + amplitude * 0.7;
    
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}