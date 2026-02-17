import player from './player.js';
import { APP_CONFIG } from './constants.js';

/**
 * Visualizer class to handle audio visualization
 */
class Visualizer {
  constructor(canvasId = 'visualizer') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = null;
    this.analyser = null;
    this.audioSource = null;
    this.animationFrame = null;
    this.isVisualizing = false;
    
    // Visualization options
    this.options = {
      type: 'bars', // 'bars', 'line', 'circle'
      color: '#bb86fc',
      lineWidth: 2,
      sensitivity: 1.0,
    };
    
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    this.initAudioContext();
  }

  /**
   * Initialize Web Audio API context
   */
  async initAudioContext() {
    try {
      // Connect to the player's audio element
      const audioElement = player.audio;
      
      if (!audioElement) {
        console.error('Could not find player audio element');
        return;
      }

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256; // Determines resolution of frequency analysis
      
      // Create source from player audio
      this.audioSource = this.audioContext.createMediaElementSource(audioElement);
      
      // Connect nodes: audio source -> analyser -> destination
      this.audioSource.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      // Setup visualization when player starts playing
      document.addEventListener('trackPlay', () => {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
        this.startVisualization();
      });
      
      document.addEventListener('trackPause', () => {
        this.stopVisualization();
      });
      
      document.addEventListener('trackEnd', () => {
        this.stopVisualization();
      });
      
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }

  /**
   * Resize canvas to match container size
   */
  resizeCanvas() {
    if (!this.canvas) return;
    
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }

  /**
   * Start the visualization
   */
  startVisualization() {
    if (!this.analyser || this.isVisualizing) return;
    
    this.isVisualizing = true;
    this.animate();
  }

  /**
   * Stop the visualization
   */
  stopVisualization() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.isVisualizing = false;
    
    // Clear the canvas
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Main animation loop
   */
  animate() {
    if (!this.isVisualizing) return;
    
    this.resizeCanvas();
    this.drawVisualization();
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  /**
   * Draw the visualization based on current settings
   */
  drawVisualization() {
    if (!this.ctx || !this.analyser || !this.canvas) return;
    
    // Get frequency data
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    switch (this.options.type) {
      case 'bars':
        this.drawBars(dataArray);
        break;
      case 'line':
        this.drawLine(dataArray);
        break;
      case 'circle':
        this.drawCircle(dataArray);
        break;
      default:
        this.drawBars(dataArray);
    }
  }

  /**
   * Draw bar visualization
   * @param {Uint8Array} dataArray - Frequency data array
   */
  drawBars(dataArray) {
    const { width, height } = this.canvas;
    const barWidth = (width / dataArray.length) * 2.5 * this.options.sensitivity;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      barHeight = (dataArray[i] / 255) * height * 0.8 * this.options.sensitivity;
      
      this.ctx.fillStyle = this.options.color;
      // Add gradient effect
      const gradient = this.ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, this.options.color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = gradient;
      
      this.ctx.fillRect(
        x, 
        height - barHeight, 
        barWidth, 
        barHeight
      );
      
      x += barWidth + 1;
    }
  }

  /**
   * Draw line visualization
   * @param {Uint8Array} dataArray - Frequency data array
   */
  drawLine(dataArray) {
    const { width, height } = this.canvas;
    
    this.ctx.beginPath();
    this.ctx.lineWidth = this.options.lineWidth;
    this.ctx.strokeStyle = this.options.color;
    
    const sliceWidth = width * 1.0 / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0 * height/2 * this.options.sensitivity;
      const y = height/2 - v;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    this.ctx.lineTo(width, height/2);
    this.ctx.stroke();
  }

  /**
   * Draw circular visualization
   * @param {Uint8Array} dataArray - Frequency data array
   */
  drawCircle(dataArray) {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    this.ctx.beginPath();
    this.ctx.lineWidth = this.options.lineWidth;
    this.ctx.strokeStyle = this.options.color;
    
    for (let i = 0; i < dataArray.length; i++) {
      const angle = (i * 2 * Math.PI) / dataArray.length;
      const amplitude = (dataArray[i] / 255) * radius * 0.5 * this.options.sensitivity;
      
      const x = centerX + (radius + amplitude) * Math.cos(angle);
      const y = centerY + (radius + amplitude) * Math.sin(angle);
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.closePath();
    this.ctx.stroke();
  }

  /**
   * Update visualization options
   * @param {Object} newOptions - New visualization options
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Change visualization type
   * @param {string} type - Type of visualization ('bars', 'line', 'circle')
   */
  setType(type) {
    if (['bars', 'line', 'circle'].includes(type)) {
      this.options.type = type;
    }
  }

  /**
   * Change visualization color
   * @param {string} color - Color in any valid CSS format
   */
  setColor(color) {
    this.options.color = color;
  }

  /**
   * Change visualization sensitivity
   * @param {number} sensitivity - Sensitivity factor (default 1.0)
   */
  setSensitivity(sensitivity) {
    this.options.sensitivity = sensitivity;
  }

  /**
   * Toggle visualization on/off
   */
  toggleVisualizer() {
    if (this.isVisualizing) {
      this.stopVisualization();
    } else {
      this.startVisualization();
    }
  }

  /**
   * Destroy the visualizer and clean up resources
   */
  destroy() {
    this.stopVisualization();
    
    if (this.audioSource && this.analyser) {
      this.audioSource.disconnect();
      this.analyser.disconnect();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Initialize visualizer if canvas element exists
document.addEventListener('DOMContentLoaded', () => {
  const visualizerCanvas = document.getElementById('visualizer');
  if (visualizerCanvas) {
    window.visualizer = new Visualizer();
  }
});

export default Visualizer;