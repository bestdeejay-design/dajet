/**
 * Search Module
 * Handles searching through albums and tracks
 */

class Search {
  constructor() {
    this.albums = [];
    this.tracks = [];
    this.searchTimeout = null;
    this.debounceDelay = 300; // milliseconds
  }
  
  // Initialize search with albums data
  init(albums) {
    this.albums = albums;
    this.tracks = this.extractTracks(albums);
  }
  
  // Extract all tracks from albums
  extractTracks(albums) {
    const tracks = [];
    
    albums.forEach(album => {
      if (album.tracksFile && window[album.id.replace(/[^a-zA-Z0-9]/g, '_')]) {
        // If we have the album tracks loaded
        const albumTracks = window[album.id.replace(/[^a-zA-Z0-9]/g, '_')];
        albumTracks.forEach((track, index) => {
          tracks.push({
            ...track,
            albumId: album.id,
            albumTitle: album.title,
            albumCover: album.cover,
            trackNumber: index + 1
          });
        });
      }
    });
    
    return tracks;
  }
  
  // Perform search with debouncing
  search(query, callback) {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      const results = this.performSearch(query);
      callback(results);
    }, this.debounceDelay);
  }
  
  // Actual search implementation
  performSearch(query) {
    if (!query || query.trim().length === 0) {
      return {
        albums: [],
        tracks: []
      };
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Search in albums
    const matchingAlbums = this.albums.filter(album => 
      album.title.toLowerCase().includes(lowerQuery) ||
      (album.year && album.year.toString().includes(lowerQuery))
    );
    
    // Search in tracks
    const matchingTracks = this.tracks.filter(track => 
      track.title.toLowerCase().includes(lowerQuery) ||
      track.artist.toLowerCase().includes(lowerQuery) ||
      (track.albumTitle && track.albumTitle.toLowerCase().includes(lowerQuery))
    );
    
    return {
      albums: matchingAlbums,
      tracks: matchingTracks
    };
  }
  
  // Filter albums by search term
  filterAlbums(query) {
    if (!query || query.trim().length === 0) {
      return this.albums;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    return this.albums.filter(album => 
      album.title.toLowerCase().includes(lowerQuery) ||
      (album.year && album.year.toString().includes(lowerQuery))
    );
  }
  
  // Filter tracks by search term
  filterTracks(query) {
    if (!query || query.trim().length === 0) {
      return this.tracks;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    return this.tracks.filter(track => 
      track.title.toLowerCase().includes(lowerQuery) ||
      track.artist.toLowerCase().includes(lowerQuery) ||
      (track.albumTitle && track.albumTitle.toLowerCase().includes(lowerQuery))
    );
  }
  
  // Update albums data
  updateAlbums(albums) {
    this.albums = albums;
    this.tracks = this.extractTracks(albums);
  }
  
  // Clear search results
  clear() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
  
  // Get all albums
  getAlbums() {
    return this.albums;
  }
  
  // Get all tracks
  getTracks() {
    return this.tracks;
  }
}

// Advanced search with filters
class AdvancedSearch extends Search {
  constructor() {
    super();
    this.filters = {
      artist: '',
      yearRange: { min: null, max: null },
      genre: '',
      sortBy: 'relevance' // relevance, title, artist, year
    };
  }
  
  // Set a filter
  setFilter(filterName, value) {
    if (this.filters.hasOwnProperty(filterName)) {
      this.filters[filterName] = value;
    }
  }
  
  // Apply all filters to search results
  applyFilters(results) {
    let filteredAlbums = [...results.albums];
    let filteredTracks = [...results.tracks];
    
    // Apply artist filter
    if (this.filters.artist) {
      const lowerArtist = this.filters.artist.toLowerCase();
      filteredAlbums = filteredAlbums.filter(album => 
        album.artist && album.artist.toLowerCase().includes(lowerArtist)
      );
      filteredTracks = filteredTracks.filter(track => 
        track.artist.toLowerCase().includes(lowerArtist)
      );
    }
    
    // Apply year range filter
    if (this.filters.yearRange.min || this.filters.yearRange.max) {
      const minYear = this.filters.yearRange.min || 0;
      const maxYear = this.filters.yearRange.max || new Date().getFullYear();
      
      filteredAlbums = filteredAlbums.filter(album => 
        album.year && album.year >= minYear && album.year <= maxYear
      );
      filteredTracks = filteredTracks.filter(track => 
        track.albumYear && track.albumYear >= minYear && track.albumYear <= maxYear
      );
    }
    
    // Apply genre filter
    if (this.filters.genre) {
      const lowerGenre = this.filters.genre.toLowerCase();
      // Assuming genre information exists in the data
      filteredAlbums = filteredAlbums.filter(album => 
        album.genre && album.genre.toLowerCase().includes(lowerGenre)
      );
      filteredTracks = filteredTracks.filter(track => 
        track.genre && track.genre.toLowerCase().includes(lowerGenre)
      );
    }
    
    // Apply sorting
    switch (this.filters.sortBy) {
      case 'title':
        filteredAlbums.sort((a, b) => a.title.localeCompare(b.title));
        filteredTracks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'artist':
        filteredAlbums.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
        filteredTracks.sort((a, b) => a.artist.localeCompare(b.artist));
        break;
      case 'year':
        filteredAlbums.sort((a, b) => (b.year || 0) - (a.year || 0));
        filteredTracks.sort((a, b) => (b.albumYear || 0) - (a.albumYear || 0));
        break;
      case 'relevance':
      default:
        // Keep original order from search results
        break;
    }
    
    return {
      albums: filteredAlbums,
      tracks: filteredTracks
    };
  }
  
  // Override search method to include filtering
  performSearch(query) {
    const basicResults = super.performSearch(query);
    return this.applyFilters(basicResults);
  }
}