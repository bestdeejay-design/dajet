import { APP_CONFIG } from './constants.js';
import stateManager from './state.js';

/**
 * Albums class to handle album collection functionality
 */
class Albums {
  constructor() {
    this.albums = [];
    this.init();
  }

  /**
   * Initialize the albums module
   */
  init() {
    this.loadAlbums();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for album-related events
   */
  setupEventListeners() {
    // Listen for external requests to refresh albums
    document.addEventListener('refreshAlbums', () => {
      this.loadAlbums();
    });
  }

  /**
   * Load albums from storage
   */
  loadAlbums() {
    try {
      const savedAlbums = localStorage.getItem(APP_CONFIG.ALBUMS_STATE_KEY);
      if (savedAlbums) {
        const parsedAlbums = JSON.parse(savedAlbums);
        if (this.validateAlbumsData(parsedAlbums)) {
          this.albums = parsedAlbums;
          // Update state manager
          stateManager.updateModule('albums', this.albums);
        } else {
          console.warn('Invalid albums data found, using defaults');
          this.albums = this.getDefaultAlbums();
          this.saveAlbums();
        }
      } else {
        // Initialize with default albums if none exist
        this.albums = this.getDefaultAlbums();
        this.saveAlbums();
      }
    } catch (error) {
      console.error('Error loading albums:', error);
      this.albums = this.getDefaultAlbums();
      this.saveAlbums();
    }
  }

  /**
   * Save albums to storage
   */
  saveAlbums() {
    try {
      // Update state manager first
      stateManager.updateModule('albums', this.albums);
      
      // Then save to localStorage
      localStorage.setItem(APP_CONFIG.ALBUMS_STATE_KEY, JSON.stringify(this.albums));
    } catch (error) {
      console.error('Error saving albums:', error);
    }
  }

  /**
   * Validate albums data structure
   * @param {Array} albumsData - Albums data to validate
   * @returns {boolean} Whether the data is valid
   */
  validateAlbumsData(albumsData) {
    if (!Array.isArray(albumsData)) {
      return false;
    }

    return albumsData.every(album => {
      return (
        typeof album === 'object' &&
        typeof album.id === 'string' &&
        typeof album.title === 'string' &&
        typeof album.artist === 'string' &&
        Array.isArray(album.tracks)
      );
    });
  }

  /**
   * Get default albums for initialization
   * @returns {Array} Array of default albums
   */
  getDefaultAlbums() {
    return [
      {
        id: 'album-1',
        title: 'DAJET Collection Vol.1',
        artist: 'Various Artists',
        year: 2023,
        cover: '/covers/default1.jpg',
        tracks: [
          {
            id: 'track-1',
            title: 'Electric Dreams',
            artist: 'Synth Wave',
            duration: 245, // in seconds
            src: '/music/electric-dreams.mp3',
            genre: 'Electronic'
          },
          {
            id: 'track-2',
            title: 'Neon Nights',
            artist: 'Retro Future',
            duration: 198,
            src: '/music/neon-nights.mp3',
            genre: 'Synthwave'
          }
        ]
      },
      {
        id: 'album-2',
        title: 'Chill Vibes',
        artist: 'Beach Lounge',
        year: 2022,
        cover: '/covers/default2.jpg',
        tracks: [
          {
            id: 'track-3',
            title: 'Sunset Boulevard',
            artist: 'Laid Back',
            duration: 267,
            src: '/music/sunset-boulevard.mp3',
            genre: 'Chillout'
          },
          {
            id: 'track-4',
            title: 'Coastal Breeze',
            artist: 'Ocean View',
            duration: 212,
            src: '/music/coastal-breeze.mp3',
            genre: 'Ambient'
          }
        ]
      }
    ];
  }

  /**
   * Get all albums
   * @returns {Array} Array of albums
   */
  getAlbums() {
    return [...this.albums];
  }

  /**
   * Get a specific album by ID
   * @param {string} albumId - Album ID
   * @returns {Object|null} Album object or null if not found
   */
  getAlbumById(albumId) {
    return this.albums.find(album => album.id === albumId) || null;
  }

  /**
   * Get all tracks from all albums
   * @returns {Array} Array of all tracks
   */
  getAllTracks() {
    const allTracks = [];
    this.albums.forEach(album => {
      album.tracks.forEach(track => {
        allTracks.push({
          ...track,
          album: album.title,
          albumId: album.id,
          artist: track.artist || album.artist
        });
      });
    });
    return allTracks;
  }

  /**
   * Get tracks from a specific album
   * @param {string} albumId - Album ID
   * @returns {Array} Array of tracks in the album
   */
  getTracksByAlbumId(albumId) {
    const album = this.getAlbumById(albumId);
    if (!album) return [];

    return album.tracks.map(track => ({
      ...track,
      album: album.title,
      albumId: album.id,
      artist: track.artist || album.artist
    }));
  }

  /**
   * Add a new album
   * @param {Object} albumData - Album data to add
   * @returns {boolean} Whether the album was added successfully
   */
  addAlbum(albumData) {
    try {
      // Validate input
      if (!albumData || !albumData.id || !albumData.title || !albumData.artist || !Array.isArray(albumData.tracks)) {
        throw new Error('Invalid album data provided');
      }

      // Check if album with this ID already exists
      if (this.getAlbumById(albumData.id)) {
        throw new Error(`Album with ID ${albumData.id} already exists`);
      }

      // Add timestamp
      const newAlbum = {
        ...albumData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.albums.push(newAlbum);
      this.saveAlbums();

      // Dispatch event to notify other modules
      this.dispatchAlbumsChanged();

      return true;
    } catch (error) {
      console.error('Error adding album:', error);
      return false;
    }
  }

  /**
   * Update an existing album
   * @param {string} albumId - Album ID to update
   * @param {Object} updatedData - Updated album data
   * @returns {boolean} Whether the album was updated successfully
   */
  updateAlbum(albumId, updatedData) {
    try {
      const albumIndex = this.albums.findIndex(album => album.id === albumId);
      if (albumIndex === -1) {
        throw new Error(`Album with ID ${albumId} not found`);
      }

      // Preserve the original creation date
      const album = this.albums[albumIndex];
      const updatedAlbum = {
        ...album,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };

      this.albums[albumIndex] = updatedAlbum;
      this.saveAlbums();

      // Dispatch event to notify other modules
      this.dispatchAlbumsChanged();

      return true;
    } catch (error) {
      console.error('Error updating album:', error);
      return false;
    }
  }

  /**
   * Delete an album
   * @param {string} albumId - Album ID to delete
   * @returns {boolean} Whether the album was deleted successfully
   */
  deleteAlbum(albumId) {
    try {
      const initialLength = this.albums.length;
      this.albums = this.albums.filter(album => album.id !== albumId);

      if (this.albums.length === initialLength) {
        throw new Error(`Album with ID ${albumId} not found`);
      }

      this.saveAlbums();

      // Dispatch event to notify other modules
      this.dispatchAlbumsChanged();

      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      return false;
    }
  }

  /**
   * Add a track to an album
   * @param {string} albumId - Album ID
   * @param {Object} trackData - Track data to add
   * @returns {boolean} Whether the track was added successfully
   */
  addTrackToAlbum(albumId, trackData) {
    try {
      const album = this.getAlbumById(albumId);
      if (!album) {
        throw new Error(`Album with ID ${albumId} not found`);
      }

      // Validate track data
      if (!trackData || !trackData.id || !trackData.title || !trackData.src) {
        throw new Error('Invalid track data provided');
      }

      // Check if track with this ID already exists in the album
      if (album.tracks.some(track => track.id === trackData.id)) {
        throw new Error(`Track with ID ${trackData.id} already exists in album ${albumId}`);
      }

      // Add timestamp
      const newTrack = {
        ...trackData,
        addedAt: new Date().toISOString()
      };

      album.tracks.push(newTrack);
      this.saveAlbums();

      // Dispatch event to notify other modules
      this.dispatchAlbumsChanged();

      return true;
    } catch (error) {
      console.error('Error adding track to album:', error);
      return false;
    }
  }

  /**
   * Remove a track from an album
   * @param {string} albumId - Album ID
   * @param {string} trackId - Track ID to remove
   * @returns {boolean} Whether the track was removed successfully
   */
  removeTrackFromAlbum(albumId, trackId) {
    try {
      const album = this.getAlbumById(albumId);
      if (!album) {
        throw new Error(`Album with ID ${albumId} not found`);
      }

      const initialLength = album.tracks.length;
      album.tracks = album.tracks.filter(track => track.id !== trackId);

      if (album.tracks.length === initialLength) {
        throw new Error(`Track with ID ${trackId} not found in album ${albumId}`);
      }

      this.saveAlbums();

      // Dispatch event to notify other modules
      this.dispatchAlbumsChanged();

      return true;
    } catch (error) {
      console.error('Error removing track from album:', error);
      return false;
    }
  }

  /**
   * Get albums by artist
   * @param {string} artist - Artist name
   * @returns {Array} Array of albums by the artist
   */
  getAlbumsByArtist(artist) {
    return this.albums.filter(album => 
      album.artist.toLowerCase().includes(artist.toLowerCase())
    );
  }

  /**
   * Get albums by year range
   * @param {number} startYear - Start year
   * @param {number} endYear - End year
   * @returns {Array} Array of albums within the year range
   */
  getAlbumsByYearRange(startYear, endYear) {
    return this.albums.filter(album => {
      if (!album.year) return false;
      return album.year >= startYear && album.year <= endYear;
    });
  }

  /**
   * Search albums by title
   * @param {string} query - Search query
   * @returns {Array} Array of matching albums
   */
  searchAlbums(query) {
    if (!query) return [];

    const normalizedQuery = query.toLowerCase().trim();
    return this.albums.filter(album => 
      album.title.toLowerCase().includes(normalizedQuery) ||
      album.artist.toLowerCase().includes(normalizedQuery)
    );
  }

  /**
   * Sort albums by a specific property
   * @param {string} sortBy - Property to sort by ('title', 'artist', 'year')
   * @param {string} order - Sort order ('asc' or 'desc')
   * @returns {Array} Sorted array of albums
   */
  sortAlbums(sortBy = 'title', order = 'asc') {
    const sortedAlbums = [...this.albums];

    sortedAlbums.sort((a, b) => {
      let valueA = a[sortBy];
      let valueB = b[sortBy];

      // Handle numeric values (like year)
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return order === 'asc' ? valueA - valueB : valueB - valueA;
      }

      // Handle string values
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
        
        if (order === 'asc') {
          return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        } else {
          return valueB < valueA ? -1 : valueB > valueA ? 1 : 0;
        }
      }

      // Fallback comparison
      return order === 'asc' ? String(valueA).localeCompare(String(valueB)) : String(valueB).localeCompare(String(valueA));
    });

    return sortedAlbums;
  }

  /**
   * Dispatch albums changed event
   */
  dispatchAlbumsChanged() {
    const event = new CustomEvent('albumsChanged', {
      detail: { albums: this.getAlbums() }
    });
    document.dispatchEvent(event);
  }

  /**
   * Import albums from external source (e.g. JSON file)
   * @param {Array} albumsData - Albums data to import
   * @returns {Object} Result of the import operation
   */
  importAlbums(albumsData) {
    try {
      if (!Array.isArray(albumsData)) {
        throw new Error('Invalid albums data format for import');
      }

      // Validate each album before importing
      const validAlbums = albumsData.filter(album => this.validateAlbumsData([album]));
      
      if (validAlbums.length !== albumsData.length) {
        console.warn(`Only ${validAlbums.length} out of ${albumsData.length} albums were valid for import`);
      }

      // Add new albums (avoid duplicates by ID)
      const importedCount = validAlbums.reduce((count, newAlbum) => {
        const existingAlbum = this.getAlbumById(newAlbum.id);
        if (!existingAlbum) {
          this.albums.push(newAlbum);
          return count + 1;
        }
        return count;
      }, 0);

      if (importedCount > 0) {
        this.saveAlbums();
        this.dispatchAlbumsChanged();
      }

      return {
        success: true,
        importedCount,
        totalCount: validAlbums.length,
        skippedCount: validAlbums.length - importedCount
      };
    } catch (error) {
      console.error('Error importing albums:', error);
      return {
        success: false,
        error: error.message,
        importedCount: 0,
        totalCount: 0,
        skippedCount: 0
      };
    }
  }

  /**
   * Export albums to external format
   * @returns {Array} Albums data ready for export
   */
  exportAlbums() {
    // Return a clean copy of albums data
    return JSON.parse(JSON.stringify(this.albums));
  }
}

// Export singleton instance
const albums = new Albums();
export default albums;