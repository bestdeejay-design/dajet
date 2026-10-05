/**
 * Генератор library.json.
 *
 * Сканирует папку albums/ и собирает описание коллекции для сайта.
 * Запускается автоматически через GitHub Actions при изменениях в albums/
 * (см. .github/workflows/generate-playlist.yml), но можно запустить и вручную:
 *
 *     node .github/scripts/generate-library.js
 *
 * Важно: файлы, которые не являются валидным изображением/аудио
 * (пустые, обрезанные, с текстом внутри) в библиотеку не попадают —
 * иначе плеер ловит ошибку воспроизведения прямо во время прослушивания.
 */
const fs = require('fs');
const path = require('path');

const albumsDir = path.join(process.cwd(), 'albums');
const outputFile = path.join(process.cwd(), 'library.json');

const audioExts = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.opus', '.flac']);
const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);

const MIN_AUDIO_BYTES = 8 * 1024;   // всё, что меньше, — заведомо битый или пустой файл
const MIN_IMAGE_BYTES = 512;

const problems = [];

function isAudio(file) { return audioExts.has(path.extname(file).toLowerCase()); }
function isImage(file) { return imageExts.has(path.extname(file).toLowerCase()); }
function isCover(file) { return path.basename(file).toLowerCase().startsWith('cover') && isImage(file); }

// Проверка «магических» сигнатур контейнеров.
function hasValidAudioHeader(filePath) {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(16);
        const read = fs.readSync(fd, buf, 0, 16, 0);
        if (read < 12) return false;
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.wav') return buf.toString('ascii', 0, 4) === 'RIFF';
        if (ext === '.ogg' || ext === '.opus') return buf.toString('ascii', 0, 4) === 'OggS';
        if (ext === '.flac') return buf.toString('ascii', 0, 4) === 'fLaC';
        if (ext === '.m4a') return buf.toString('ascii', 4, 8) === 'ftyp';
        if (ext === '.mp3') return buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
        return true;
    } finally {
        fs.closeSync(fd);
    }
}

function isUsableFile(filePath, kind) {
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (err) {
        problems.push(`${filePath}: файл недоступен (${err.message})`);
        return false;
    }
    const minSize = kind === 'audio' ? MIN_AUDIO_BYTES : MIN_IMAGE_BYTES;
    if (stat.size < minSize) {
        problems.push(`${filePath}: подозрительно маленький размер (${stat.size} байт) — пропущен`);
        return false;
    }
    if (kind === 'audio' && !hasValidAudioHeader(filePath)) {
        problems.push(`${filePath}: файл не похож на аудио (${stat.size} байт) — пропущен`);
        return false;
    }
    return true;
}

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
    // Сортируем альбомы по имени — порядок в галерее не должен «прыгать»
    // от запуска к запуску.
    const albumFolders = fs.readdirSync(albumsDir)
        .filter((item) => fs.statSync(path.join(albumsDir, item)).isDirectory())
        .sort((a, b) => a.localeCompare(b, 'ru'));

    for (const folder of albumFolders) {
        const albumPath = path.join(albumsDir, folder);
        const files = fs.readdirSync(albumPath);

        // Обложка альбома
        const cover = files.find((f) => isCover(f) && isUsableFile(path.join(albumPath, f), 'image'));
        const coverUrl = cover ? `albums/${folder}/${cover}` : null;

        // Треки
        const tracks = [];
        const audioFiles = files
            .filter((f) => isAudio(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        for (const audio of audioFiles) {
            const audioPath = path.join(albumPath, audio);
            if (!isUsableFile(audioPath, 'audio')) continue;

            const base = path.basename(audio, path.extname(audio));
            // Ищем обложку трека (файл с тем же именем, но нормализованным)
            const trackCover = files.find((f) => {
                if (!isImage(f)) return false;
                const fBase = path.basename(f, path.extname(f));
                // Сравниваем нормализованные имена
                return normalizeName(fBase) === normalizeName(base) &&
                    isUsableFile(path.join(albumPath, f), 'image');
            });

            tracks.push({
                name: trimName(base),
                file: `albums/${folder}/${audio}`,
                cover: trackCover ? `albums/${folder}/${trackCover}` : null
            });
        }

        if (tracks.length > 0) {
            albums.push({
                id: folder,
                title: folder,
                cover: coverUrl,
                tracks: tracks
            });
        } else {
            problems.push(`альбом «${folder}»: нет ни одного пригодного трека — исключён из библиотеки`);
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(albums, null, 2) + '\n');

    const trackCount = albums.reduce((sum, album) => sum + album.tracks.length, 0);
    console.log(`✅ library.json создан: альбомов ${albums.length}, треков ${trackCount}`);

    if (problems.length > 0) {
        console.warn(`\n⚠️  Проблемных файлов: ${problems.length}`);
        problems.forEach((p) => console.warn(`   - ${p}`));
        if (process.env.GITHUB_ACTIONS) {
            problems.forEach((p) => console.log(`::warning title=Битый медиафайл::${p}`));
        }
    }
}

generate();
