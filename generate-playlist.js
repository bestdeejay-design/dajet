/**
 * DAJET Playlist Generator
 * Generates JavaScript files with album and track information
 */

const fs = require('fs');
const path = require('path');

// Default configuration
const defaultConfig = {
  albumsFolder: 'albums',
  outputFolder: 'data',
  defaultArtist: 'BEST',
  supportedAudio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a'],
  supportedImages: ['.jpg', '.jpeg', '.png', '.webp'],
  coverNames: ['cover', 'folder', 'album'],
  sortAlbums: 'name',
  sortTracks: 'name'
};

// Load configuration
function loadConfig() {
  const configPath = './config.json';
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    return { ...defaultConfig, ...JSON.parse(configContent) };
  }
  return defaultConfig;
}

// Get current timestamp
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

// Find cover image in a folder
function findCover(folderPath, config) {
  for (const coverName of config.coverNames) {
    for (const ext of config.supportedImages) {
      const coverPath = path.join(folderPath, coverName + ext);
      if (fs.existsSync(coverPath)) {
        return path.relative('.', coverPath).replace(/\\/g, '/');
      }
    }
  }
  
  // If no standard cover found, look for any image file
  try {
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (config.supportedImages.includes(ext)) {
        return path.relative('.', path.join(folderPath, file)).replace(/\\/g, '/');
      }
    }
  } catch (error) {
    console.error(`Error reading folder ${folderPath}:`, error.message);
  }
  
  return null;
}

// Get all audio files in a folder
function getAudioFiles(folderPath, config) {
  const files = [];
  
  try {
    const dirEntries = fs.readdirSync(folderPath);
    
    for (const entry of dirEntries) {
      const fullPath = path.join(folderPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(entry).toLowerCase();
        if (config.supportedAudio.includes(ext)) {
          const fileNameWithoutExt = path.basename(entry, path.extname(entry));
          
          // Look for individual track cover
          let trackCover = null;
          for (const imgExt of config.supportedImages) {
            const possibleCoverPath = path.join(folderPath, fileNameWithoutExt + imgExt);
            if (fs.existsSync(possibleCoverPath)) {
              trackCover = path.relative('.', possibleCoverPath).replace(/\\/g, '/');
              break;
            }
          }
          
          files.push({
            file: path.relative('.', fullPath).replace(/\\/g, '/'),
            cover: trackCover,
            title: fileNameWithoutExt,
            artist: config.defaultArtist
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading folder ${folderPath}:`, error.message);
  }
  
  // Sort tracks
  if (config.sortTracks === 'name') {
    files.sort((a, b) => a.title.localeCompare(b.title));
  }
  
  return files;
}

// Process a single album folder
function processAlbum(albumFolderPath, config) {
  const albumName = path.basename(albumFolderPath);
  
  // Find album cover
  const cover = findCover(albumFolderPath, config);
  
  // Get all audio files
  const tracks = getAudioFiles(albumFolderPath, config);
  
  // Generate album ID (URL-safe)
  const albumId = albumName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
  
  // Try to extract year from folder name (4 digits between 1900 and 2100)
  const yearMatch = albumName.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
  
  return {
    id: albumId,
    title: albumName,
    path: path.relative('.', albumFolderPath).replace(/\\/g, '/'),
    cover: cover,
    tracksFile: `data/albums/${encodeURIComponent(albumName)}.js`,
    trackCount: tracks.length,
    year: year
  };
}

// Write album tracks to a file
function writeAlbumTracks(album, tracks, config) {
  const outputPath = path.join(config.outputFolder, 'albums', encodeURIComponent(album.title) + '.js');
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const content = `// Авто-генерация: ${getTimestamp()}
// Альбом: ${album.title}
// Не редактируйте вручную — изменения будут перезаписаны

const ALBUM_TRACKS = ${JSON.stringify(tracks, null, 2)};
`;
  
  fs.writeFileSync(outputPath, content);
  console.log(`✅ Записан файл: ${outputPath} (${tracks.length} треков)`);
}

// Main function to generate playlists
function generatePlaylist() {
  const config = loadConfig();
  console.log(`🎵 Запуск генерации плейлистов...`);
  console.log(`📁 Папка с альбомами: ${config.albumsFolder}`);
  console.log(`📂 Папка вывода: ${config.outputFolder}`);
  console.log('');
  
  // Create output directory structure
  if (!fs.existsSync(config.outputFolder)) {
    fs.mkdirSync(config.outputFolder, { recursive: true });
  }
  
  const albumsOutputDir = path.join(config.outputFolder, 'albums');
  if (!fs.existsSync(albumsOutputDir)) {
    fs.mkdirSync(albumsOutputDir, { recursive: true });
  }
  
  // Read all folders in albums directory
  if (!fs.existsSync(config.albumsFolder)) {
    console.error(`❌ Папка ${config.albumsFolder} не найдена!`);
    return;
  }
  
  const albumFolders = fs.readdirSync(config.albumsFolder)
    .map(folder => path.join(config.albumsFolder, folder))
    .filter(filePath => fs.statSync(filePath).isDirectory());
  
  const albums = [];
  let totalTracks = 0;
  
  for (const albumFolder of albumFolders) {
    console.log(`🔍 Обработка альбома: ${path.basename(albumFolder)}`);
    
    const album = processAlbum(albumFolder, config);
    const tracks = getAudioFiles(albumFolder, config);
    
    if (tracks.length > 0) {
      albums.push(album);
      totalTracks += tracks.length;
      
      // Write tracks file
      writeAlbumTracks(album, tracks, config);
    } else {
      console.log(`⚠️  В альбоме ${path.basename(albumFolder)} не найдено аудиофайлов`);
    }
  }
  
  // Sort albums
  if (config.sortAlbums === 'name') {
    albums.sort((a, b) => a.title.localeCompare(b.title));
  } else if (config.sortAlbums === 'year' && albums.every(album => album.year !== null)) {
    albums.sort((a, b) => (a.year || 0) - (b.year || 0));
  }
  
  // Write main albums file
  const albumsFilePath = path.join(config.outputFolder, 'albums.js');
  const albumsContent = `// Авто-генерация: ${getTimestamp()}
// Не редактируйте вручную — изменения будут перезаписаны

const ALBUMS = ${JSON.stringify(albums, null, 2)};
`;
  
  fs.writeFileSync(albumsFilePath, albumsContent);
  console.log(`✅ Записан основной файл: ${albumsFilePath}`);
  
  // Calculate total data size
  let totalSize = 0;
  const allFiles = [albumsFilePath, ...albums.map(album => 
    path.join(config.outputFolder, 'albums', encodeURIComponent(album.title) + '.js')
  )];
  
  for (const filePath of allFiles) {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
  }
  
  console.log('');
  console.log('📊 Результаты:');
  console.log(`✅ Найдено альбомов: ${albums.length}`);
  console.log(`✅ Всего треков: ${totalTracks}`);
  console.log(`✅ Сгенерировано файлов: ${allFiles.length}`);
  console.log(`📊 Размер данных: ${(totalSize / 1024).toFixed(1)} КБ`);
  console.log('');
  console.log('✨ Готово!');
}

// Run the generator
if (require.main === module) {
  generatePlaylist();
}

module.exports = {
  generatePlaylist,
  loadConfig,
  processAlbum,
  getAudioFiles
};