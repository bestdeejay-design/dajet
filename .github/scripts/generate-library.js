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
const { execFileSync, spawnSync } = require('child_process');

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

// --------------------------------------------------------------- аудиоанализ
// Громкость и текст песни берём из самих файлов (ffmpeg/ffprobe). На GitHub
// Runners они есть из коробки. Если инструментов нет — просто пропускаем шаг,
// значения из предыдущего library.json при этом сохраняются.

function commandExists(cmd) {
    try {
        execFileSync(cmd, ['-version'], { stdio: 'ignore' });
        return true;
    } catch (err) {
        return false;
    }
}

const hasFfprobe = commandExists('ffprobe');
const hasFfmpeg = commandExists('ffmpeg');

function readLyrics(filePath) {
    if (!hasFfprobe) return null;
    try {
        const out = execFileSync('ffprobe',
            ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath],
            { encoding: 'utf8', timeout: 30000 });
        const tags = (JSON.parse(out).format || {}).tags || {};
        for (const [key, value] of Object.entries(tags)) {
            if (/^(lyrics|©lyr|unsyncedlyrics)$/i.test(key) && value && value.trim()) {
                return value.replace(/\r\n/g, '\n').trim();
            }
        }
    } catch (err) {
        /* нет текста или файл не читается */
    }
    return null;
}

/**
 * Анализ звука одним проходом ffmpeg:
 *   lufs  — интегрированная громкость (EBU R128), чтобы треки не «прыгали»;
 *   peak  — истинный пик (dBTP), чтобы не усиливать трек в клиппинг;
 *   trim  — тишина в начале файла (сек), чтобы трек начинался сразу.
 */
function analyzeAudio(filePath) {
    if (!hasFfmpeg) return null;
    try {
        // ВАЖНО: ffmpeg пишет отчёт об анализе в stderr, поэтому используем
        // spawnSync — иначе на выходе окажется пустая строка и все значения
        // молча станут null.
        const result = spawnSync('ffmpeg',
            ['-hide_banner', '-nostdin', '-i', filePath,
             '-af', 'silencedetect=noise=-45dB:d=0.35,loudnorm=print_format=summary',
             '-f', 'null', '-'],
            { encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });

        const out = result.stderr || '';
        if (!out) {
            problems.push(`${filePath}: не удалось прочитать анализ звука`);
            return null;
        }

        const lufsMatch = /Input Integrated:\s+(-?[\d.]+) LUFS/.exec(out);
        const peakMatch = /Input True Peak:\s+(-?\+?[\d.]+) dBTP/.exec(out);

        // Тишина в начале: пара silence_start ≈ 0 → silence_end
        const events = [];
        const re = /silence_(start|end):\s*(-?[\d.]+(?:e[-+]?\d+)?)/g;
        let m;
        while ((m = re.exec(out)) !== null) events.push([m[1], parseFloat(m[2])]);

        let trim = null;
        if (events.length >= 2 && events[0][0] === 'start' && events[0][1] <= 0.05 && events[1][0] === 'end') {
            const gap = events[1][1];
            // Обрезаем только заметную паузу в начале: меньше 0.4 с слушатель
            // не замечает, а больше 1.5 с — скорее всего осознанная тишина,
            // часть замысла, её не трогаем. Порог -45 dB гарантирует, что
            // в обрезку попадает только настоящая тишина, а не тихое вступление.
            if (gap >= 0.4 && gap <= 1.5) trim = Math.round(gap * 100) / 100;
        }

        const lufs = lufsMatch ? Math.round(parseFloat(lufsMatch[1]) * 10) / 10 : null;
        const peak = peakMatch ? Math.round(parseFloat(peakMatch[1]) * 10) / 10 : null;
        if (lufs == null || peak == null) {
            problems.push(`${filePath}: не удалось измерить громкость/пик (проверьте файл)`);
        }
        return { lufs, peak, trim };
    } catch (err) {
        return null;
    }
}

// Значения из прошлого library.json переиспользуем, если файл не изменился
// (сравниваем по размеру) — чтобы не гонять анализ по 12 часам звука заново.
function loadPrevious() {
    const cache = new Map();
    if (!fs.existsSync(outputFile)) return cache;
    try {
        const prev = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        for (const album of prev) {
            for (const track of album.tracks || []) {
                if (!track.file) continue;
                let size = null;
                try { size = fs.statSync(track.file).size; } catch (err) { /* файла нет */ }
                cache.set(track.file, {
                    size,
                    lufs: track.lufs,
                    peak: track.peak,
                    trim: track.trim,
                    lyrics: track.lyrics
                });
            }
        }
    } catch (err) {
        console.warn('Не удалось прочитать предыдущий library.json:', err.message);
    }
    return cache;
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

    const previous = loadPrevious();
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

            const relPath = `albums/${folder}/${audio}`;
            const entry = {
                name: trimName(base),
                file: relPath,
                cover: trackCover ? `albums/${folder}/${trackCover}` : null
            };

            const cached = previous.get(relPath);
            const size = fs.statSync(audioPath).size;
            // Файл не менялся — прошлые измерения (громкость, пик, обрезка,
            // текст) ещё верны и их можно переиспользовать: анализ 227 треков
            // занимает десятки минут. Пересчитываем только то, чего в кэше нет.
            const sizeUnchanged = !!(cached && cached.size === size);

            let analysis = sizeUnchanged && cached.peak !== undefined
                ? { lufs: cached.lufs, peak: cached.peak, trim: cached.trim != null ? cached.trim : null }
                : null;
            if (!analysis || analysis.lufs == null || analysis.peak == null) {
                analysis = analyzeAudio(audioPath);
            }

            if (analysis && analysis.lufs != null) entry.lufs = analysis.lufs;
            if (analysis && analysis.peak != null) entry.peak = analysis.peak;
            if (analysis && analysis.trim != null) entry.trim = analysis.trim;

            // Текст песни не должен теряться, даже если ffprobe временно
            // недоступен: сохранённое значение имеет приоритет над неудачей.
            const lyrics = (sizeUnchanged && cached.lyrics) ? cached.lyrics : readLyrics(audioPath);
            if (lyrics) entry.lyrics = lyrics;
            else if (sizeUnchanged && cached.lyrics) entry.lyrics = cached.lyrics;

            tracks.push(entry);
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
    const withLoudness = albums.reduce((sum, a) => sum + a.tracks.filter((t) => t.lufs != null).length, 0);
    const withLyrics = albums.reduce((sum, a) => sum + a.tracks.filter((t) => t.lyrics).length, 0);
    const withTrim = albums.reduce((sum, a) => sum + a.tracks.filter((t) => t.trim != null).length, 0);
    const withPeak = albums.reduce((sum, a) => sum + a.tracks.filter((t) => t.peak != null).length, 0);
    console.log(`✅ library.json создан: альбомов ${albums.length}, треков ${trackCount}`);
    console.log(`   громкость измерена: ${withLoudness}, пики: ${withPeak},`);
    console.log(`   обрезка вступления: ${withTrim}, тексты песен: ${withLyrics}`);
    if (!hasFfmpeg || !hasFfprobe) {
        console.warn('   ⚠️  ffmpeg/ffprobe не найдены: новые треки останутся без данных о громкости и текста');
    }

    if (problems.length > 0) {
        console.warn(`\n⚠️  Проблемных файлов: ${problems.length}`);
        problems.forEach((p) => console.warn(`   - ${p}`));
        if (process.env.GITHUB_ACTIONS) {
            problems.forEach((p) => console.log(`::warning title=Битый медиафайл::${p}`));
        }
    }
}

generate();
