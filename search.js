import { APP_CONFIG, EVENTS } from './constants.js';
import stateManager from './state.js';

/**
 * Search class to handle music search functionality
 */
class Search {
  constructor() {
    this.searchTimeout = null;
    this.lastQuery = '';
    this.init();
  }

  /**
   * Initialize the search module
   */
  init() {
    // Listen for search events
    document.addEventListener('searchRequest', (e) => {
      this.performSearch(e.detail.query);
    });
  }

  /**
   * Perform search with debouncing
   * @param {string} query - Search query
   */
  performSearch(query) {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Store the query
    this.lastQuery = query;

    // Debounce the search
    this.searchTimeout = setTimeout(() => {
      this.executeSearch(query);
    }, APP_CONFIG.SEARCH_DEBOUNCE_TIME);
  }

  /**
   * Execute the actual search
   * @param {string} query - Search query
   */
  async executeSearch(query) {
    try {
      if (!query.trim()) {
        // If query is empty, clear results
        stateManager.updateModule('search', {
          query: '',
          results: []
        });
        this.dispatchSearchResults([]);
        return;
      }

      // Update the search query in state
      stateManager.updateModule('search', { query });

      // Simulate API call or local search
      const results = await this.searchTracks(query);

      // Update state with results
      stateManager.updateModule('search', { results });

      // Dispatch results to UI
      this.dispatchSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      
      // Update state with empty results on error
      stateManager.updateModule('search', { results: [] });
      
      // Dispatch empty results
      this.dispatchSearchResults([]);
      
      // Optionally dispatch error event
      this.dispatchSearchError(error.message);
    }
  }

  /**
   * Search tracks in the collection
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching tracks
   */
  async searchTracks(query) {
    // Normalize the query for comparison
    const normalizedQuery = query.toLowerCase().trim();

    // Get all tracks from state (this would normally come from albums or a separate tracks store)
    const currentState = stateManager.getState();
    const allTracks = this.getAllTracksFromState(currentState);

    // Filter tracks based on query
    const results = allTracks.filter(track => {
      // Check title, artist, album, and genre fields
      return (
        (track.title && track.title.toLowerCase().includes(normalizedQuery)) ||
        (track.artist && track.artist.toLowerCase().includes(normalizedQuery)) ||
        (track.album && track.album.toLowerCase().includes(normalizedQuery)) ||
        (track.genre && track.genre.toLowerCase().includes(normalizedQuery))
      );
    });

    return results;
  }

  /**
   * Get all tracks from the state
   * @param {Object} state - Application state
   * @returns {Array} Array of all tracks
   */
  getAllTracksFromState(state) {
    const tracks = [];

    // Extract tracks from albums
    if (Array.isArray(state.albums)) {
      state.albums.forEach(album => {
        if (Array.isArray(album.tracks)) {
          album.tracks.forEach(track => {
            tracks.push({
              ...track,
              album: album.title,
              albumId: album.id,
              artist: track.artist || album.artist
            });
          });
        }
      });
    }

    // Extract tracks from playlists
    if (Array.isArray(state.playlist)) {
      state.playlist.forEach(track => {
        tracks.push(track);
      });
    }

    return tracks;
  }

  /**
   * Dispatch search results to other modules
   * @param {Array} results - Search results
   */
  dispatchSearchResults(results) {
    const event = new CustomEvent('searchResults', {
      detail: { results }
    });
    document.dispatchEvent(event);
  }

  /**
   * Dispatch search error to other modules
   * @param {string} errorMessage - Error message
   */
  dispatchSearchError(errorMessage) {
    const event = new CustomEvent('searchError', {
      detail: { error: errorMessage }
    });
    document.dispatchEvent(event);
  }

  /**
   * Clear search results
   */
  clearSearch() {
    stateManager.updateModule('search', {
      query: '',
      results: []
    });
    
    this.dispatchSearchResults([]);
  }

  /**
   * Advanced search with filters
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @param {string} filters.artist - Artist filter
   * @param {string} filters.album - Album filter
   * @param {string} filters.genre - Genre filter
   * @param {number} filters.yearFrom - Year from filter
   * @param {number} filters.yearTo - Year to filter
   * @returns {Promise<Array>} Array of matching tracks
   */
  async advancedSearch(query, filters = {}) {
    try {
      // Update state with query and filters
      stateManager.updateModule('search', { 
        query, 
        filters 
      });

      // Get all tracks
      const currentState = stateManager.getState();
      const allTracks = this.getAllTracksFromState(currentState);

      // Filter tracks based on query and filters
      let results = allTracks;

      // Apply query filter
      if (query && query.trim()) {
        const normalizedQuery = query.toLowerCase().trim();
        results = results.filter(track => {
          return (
            (track.title && track.title.toLowerCase().includes(normalizedQuery)) ||
            (track.artist && track.artist.toLowerCase().includes(normalizedQuery)) ||
            (track.album && track.album.toLowerCase().includes(normalizedQuery)) ||
            (track.genre && track.genre.toLowerCase().includes(normalizedQuery))
          );
        });
      }

      // Apply additional filters
      if (filters.artist) {
        results = results.filter(track => 
          track.artist && track.artist.toLowerCase().includes(filters.artist.toLowerCase())
        );
      }

      if (filters.album) {
        results = results.filter(track => 
          track.album && track.album.toLowerCase().includes(filters.album.toLowerCase())
        );
      }

      if (filters.genre) {
        results = results.filter(track => 
          track.genre && track.genre.toLowerCase().includes(filters.genre.toLowerCase())
        );
      }

      if (filters.yearFrom) {
        results = results.filter(track => 
          track.year && track.year >= filters.yearFrom
        );
      }

      if (filters.yearTo) {
        results = results.filter(track => 
          track.year && track.year <= filters.yearTo
        );
      }

      // Update state with results
      stateManager.updateModule('search', { results });

      // Dispatch results
      this.dispatchSearchResults(results);

      return results;
    } catch (error) {
      console.error('Advanced search error:', error);
      this.dispatchSearchError(error.message);
      return [];
    }
  }
}

// Export singleton instance
const search = new Search();
export default search;