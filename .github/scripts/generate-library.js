const fs = require('fs');
const path = require('path');

const albumsDir = path.join(process.cwd(), 'albums');
const outputFile = path.join(process.cwd(), 'library.json');

const audioExts = new Set(['.mp3', '.m4a', '.wav', '.ogg']);
const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function isAudio(file) { return audioExts.has(path.extname(file).toLowerCase()); }
function isImage(file) { return imageExts.has(path.extname(file).toLowerCase()); }
function isCover(file) { return path.basename(file).toLowerCase().startsWith('cover') && isImage(file); }

// Нормализация имени: убираем лишние пробелы, обрезаем, нижний регистр
function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')  // заменяем множественные пробелы на один
        .trim();                // убираем пробелы в начале и конце
}

function trimName(name) {
    return name.replace(/\s+/g, ' ').trim();
}

function generate() {
  if (!fs.existsSync(albumsDir)) {
    console.error('Папка albums не найдена');
    process.exit(1);
  }

  const albums = [];
  const albumFolders = fs.readdirSync(albumsDir).filter(item => {
    const full = path.join(albumsDir, item);
    return fs.statSync(full).isDirectory();
  });

  for (const folder of albumFolders) {
    const albumPath = path.join(albumsDir, folder);
    const files = fs.readdirSync(albumPath);

    // Обложка альбома
    let cover = files.find(f => isCover(f));
    let coverUrl = cover ? `albums/${folder}/${cover}` : null;

    // Треки
    const tracks = [];
    const audioFiles = files.filter(f => isAudio(f)).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

    for (const audio of audioFiles) {
      const base = path.basename(audio, path.extname(audio));
      // Ищем обложку трека (файл с тем же именем, но нормализованным)
      let trackCover = files.find(f => {
        if (!isImage(f)) return false;
        const fBase = path.basename(f, path.extname(f));
        // Сравниваем нормализованные имена
        return normalizeName(fBase) === normalizeName(base);
      });
      let trackCoverUrl = trackCover ? `albums/${folder}/${trackCover}` : null;

      tracks.push({
        name: trimName(base),
        file: `albums/${folder}/${audio}`,
        cover: trackCoverUrl
      });
    }

    if (tracks.length > 0) {
      albums.push({
        id: folder,
        title: folder,
        cover: coverUrl,
        tracks: tracks
      });
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(albums, null, 2));
  console.log(`✅ library.json создан, альбомов: ${albums.length}`);
}

generate();
