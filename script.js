/* ==========================================================
   DAJET Music Player – логика плеера
   ========================================================== */

class DAJETPlayer {
    constructor() {
        // ---------------------- DOM‑элементы ----------------------
        this.elements = {
            themeToggle: document.getElementById('theme-toggle'),
            searchInput: document.getElementById('searchInput'),
            albumsGrid: document.getElementById('albumsGrid'),
            albumView: document.getElementById('albumView'),
            albumCover: document.getElementById('albumCover'),
            albumTitle: document.getElementById('albumTitle'),
            albumTrackCount: document.getElementById('albumTrackCount'),
            tracksList: document.getElementById('tracksList'),
            backToAlbums: document.getElementById('backToAlbums'),
            player: document.getElementById('player'),
            currentTrackCover: document.getElementById('currentTrackCover'),
            currentTrackTitle: document.getElementById('currentTrackTitle'),
            currentTrackArtist: document.getElementById('currentTrackArtist'),
            currentTime: document.getElementById('currentTime'),
            duration: document.getElementById('duration'),
            progressBar: document.getElementById('progressBar'),
            volumeSlider: document.getElementById('volumeSlider'),
            playBtn: document.getElementById('playBtn'),
            stopBtn: document.getElementById('stopBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            shuffleBtn: document.getElementById('shuffleBtn'),
            repeatBtn: document.getElementById('repeatBtn')
        };

        // ---------------------- Состояние ----------------------
        this.state = {
            currentAlbum: null,
            currentTrackIndex: 0,
            isPlaying: false,
            isShuffled: false,
            repeatMode: 'all',          // none | one | all
            currentPlaylist: [],
            originalPlaylist: [],
            audio: new Audio(),
            searchTimeout: null
        };

        // ---------------------- Инициализация ----------------------
        this.init();
    }

    /* ------------------------------------------------------------------ *
     *  Инициализация
     * ------------------------------------------------------------------ */
    init() {
        this.loadTheme();
        this.loadAlbums();
        this.bindEvents();
        this.loadState();
    }

    /* ------------------------------------------------------------------ *
     *  Тема
     * ------------------------------------------------------------------ */
    loadTheme() {
        if (window.ThemeManager?.getTheme) {
            const cur = window.ThemeManager.getTheme();
            document.documentElement.setAttribute('data-theme', cur);
        }
    }

    toggleTheme() {
        if (window.ThemeManager?.toggle) {
            window.ThemeManager.toggle();
        }
        if (window.StrobeEffect?.onThemeChange) {
            window.StrobeEffect.onThemeChange();
        }
    }

    /* ------------------------------------------------------------------ *
     *  События
     * ------------------------------------------------------------------ */
    bindEvents() {
        this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());

        this.elements.searchInput?.addEventListener('input', e => this.handleSearch(e));

        this.elements.backToAlbums?.addEventListener('click', () => this.showAlbums());

        this.elements.playBtn?.addEventListener('click', () => this.togglePlay());
        this.elements.stopBtn?.addEventListener('click', () => this.stop());
        this.elements.prevBtn?.addEventListener('click', () => this.previousTrack());
        this.elements.nextBtn?.addEventListener('click', () => this.nextTrack());
        this.elements.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
        this.elements.repeatBtn?.addEventListener('click', () => this.toggleRepeat());

        this.elements.progressBar?.addEventListener('input', e => this.seek(e));
        this.elements.volumeSlider?.addEventListener('input', e => this.setVolume(e));

        this.state.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.state.audio.addEventListener('ended',      () => this.onTrackEnd());
        this.state.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.state.audio.addEventListener('error', e => this.handleError(e));

        document.addEventListener('keydown', e => this.handleKeydown(e));

        this.setupStrobeIntegration();
    }

    setupStrobeIntegration() {
        document.addEventListener('music:play',  () => window.StrobeEffect?.play());
        document.addEventListener('music:pause', () => window.StrobeEffect?.pause());
        document.addEventListener('music:stop',  () => window.StrobeEffect?.stop());
    }

    /* ------------------------------------------------------------------ *
     *  Загрузка альбомов
     * ------------------------------------------------------------------ */
    async loadAlbums() {
        if (!window.ALBUMS || !Array.isArray(window.ALBUMS)) {
            try {
                const resp = await fetch('data/albums.js');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const txt = await resp.text();

                const match = txt.match(/const\s+ALBUMS\s*=\s*(\[[\s\S]*?\]);/);
                if (!match) throw new Error('ALBUMS not found');

                window.ALBUMS = JSON.parse(match[1]);
            } catch (err) {
                console.error('❌ Ошибка загрузки albums.js', err);
                this.showError('Не удалось загрузить список альбомов');
                return;
            }
        }
        this.renderAlbums();
    }

    renderAlbums() {
        this.elements.albumsGrid.innerHTML = '';
        for (const album of window.ALBUMS) {
            this.elements.albumsGrid.appendChild(this.createAlbumCard(album));
        }
    }

    createAlbumCard(album) {
        const div = document.createElement('div');
        div.className = 'album-card';
        div.innerHTML = `
            <img src="${album.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMTAwIiBmaWxsPSIjMzU1N2FhIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTA1IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI0OCIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pgo8L3N2Zz4K'}"
              alt="${album.title}" class="album-cover" loading="lazy">
            <div class="album-info-card">
                <h3 class="album-title">${this.escapeHtml(album.title)}</h3>
                <p class="album-track-count">${album.trackCount} треков</p>
            </div>
        `;
        div.addEventListener('click', () => this.loadAlbumTracks(album));
        return div;
    }

    escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    /* ------------------------------------------------------------------ *
     *  Загрузка треков альбома
     * ------------------------------------------------------------------ */
    async loadAlbumTracks(album) {
        try {
            const resp = await fetch(album.tracksFile);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const txt = await resp.text();

            const match = txt.match(/const\s+ALBUM_TRACKS\s*=\s*(\[[\s\S]*?\]);/);
            if (!match) throw new Error('ALBUM_TRACKS not found');

            const tracks = JSON.parse(match[1]);

            this.state.currentAlbum = album;
            this.state.currentPlaylist = [...tracks];
            this.state.originalPlaylist = [...tracks];
            this.state.currentTrackIndex = 0;

            this.displayAlbumTracks(album, tracks);
            this.showAlbumView();
        } catch (err) {
            console.error('❌ Ошибка загрузки треков', err);
            this.showError(`Не удалось загрузить треки «${album.title}»`);
        }
    }

    displayAlbumTracks(album, tracks) {
        this.elements.albumCover.src = album.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9Ijc1IiBmaWxsPSIjMzU1N2FhIi8+Cjx0ZXh0IHg9Ijc1IiB5PSI4MCIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMzYiIGZvbnQtZmFtaWx5PSJBcmlhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RDwvdGV4dD4KPC9zdmc+Cg==';
        this.elements.albumTitle.textContent = album.title;
        this.elements.albumTrackCount.textContent = `${tracks.length} треков`;

        this.elements.tracksList.innerHTML = '';
        tracks.forEach((track, i) => {
            const el = document.createElement('div');
            el.className = 'track-item';
            el.innerHTML = `
                <span class="track-number">${i + 1}.</span>
                <img src="${track.cover || album.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzNTU3YWEiLz4KPHRleHQgeD0iMjAiIHk9IjIzIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pgo8L3N2Zz4K'}"
                     alt="${track.title}" class="track-cover" loading="lazy">
                <div class="track-details">
                    <div class="track-title">${this.escapeHtml(track.title)}</div>
                    <div class="track-artist">${this.escapeHtml(track.artist)}</div>
                </div>
            `;
            el.addEventListener('click', () => this.playTrack(i));
            this.elements.tracksList.appendChild(el);
        });
    }

    showAlbums() {
        this.elements.albumsGrid.classList.remove('hidden');
        this.elements.albumView.classList.add('hidden');
        this.state.currentAlbum = null;
    }

    showAlbumView() {
        this.elements.albumsGrid.classList.add('hidden');
        this.elements.albumView.classList.remove('hidden');
    }

    /* ------------------------------------------------------------------ *
     *  Управление воспроизведением
     * ------------------------------------------------------------------ */
async playTrack(idx) {
    if (idx < 0 || idx >= this.state.currentPlaylist.length) return;

    const track = this.state.currentPlaylist[idx];
    this.state.currentTrackIndex = idx;

    // Устанавливаем путь к файлу и воспроизводим
    this.state.audio.src = track.file;
    
    this.elements.currentTrackTitle.textContent  = track.title;
    this.elements.currentTrackArtist.textContent = track.artist;
    this.elements.currentTrackCover.src = track.cover ||
        this.state.currentAlbum?.cover ||
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiMzNTU3YWEiLz4KPHRleHQgeD0iMzIiIHk9IjM2IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNiIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pgo8L3N2Zz4K';

    // Асинхронно загружаем трек и воспроизводим
    try {
        await this.state.audio.play();
        this.state.isPlaying = true;
        this.updatePlayButton();
        document.dispatchEvent(new CustomEvent('music:play'));
    } catch (err) {
        console.error('❌ Ошибка воспроизведения', err);
        // Для AbortError не пытаемся следующий трек
        if (err.name !== 'AbortError') {
            this.showError('Не удалось воспроизвести трек');
            this.nextTrack();
        }
    }

    this.elements.player.classList.remove('hidden');
    this.saveState();
}


    togglePlay() {
        if (this.state.isPlaying) {
            this.state.audio.pause();
            document.dispatchEvent(new CustomEvent('music:pause'));
        } else {
            if (this.state.audio.src) {
                this.state.audio.play();
                document.dispatchEvent(new CustomEvent('music:play'));
            } else if (this.state.currentPlaylist.length) {
                this.playTrack(this.state.currentTrackIndex);
            }
        }
        this.state.isPlaying = !this.state.isPlaying;
        this.updatePlayButton();
    }

    stop() {
        this.state.audio.pause();
        this.state.audio.currentTime = 0;
        this.state.isPlaying = false;
        this.updatePlayButton();
        this.updateProgress();
        document.dispatchEvent(new CustomEvent('music:stop'));
    }

    previousTrack() {
        if (!this.state.currentPlaylist.length) return;

        if (this.state.audio.currentTime > 3) {
            this.state.audio.currentTime = 0;
            return;
        }

        let newIdx = this.state.currentTrackIndex - 1;
        if (newIdx < 0) {
            if (this.state.repeatMode === 'all') {
                newIdx = this.state.currentPlaylist.length - 1;
            } else {
                this.stop();
                return;
            }
        }
        this.playTrack(newIdx);
    }

    nextTrack() {
        if (!this.state.currentPlaylist.length) return;

        let newIdx = this.state.currentTrackIndex + 1;
        if (newIdx >= this.state.currentPlaylist.length) {
            if (this.state.repeatMode === 'all') {
                newIdx = 0;
            } else {
                this.stop();
                return;
            }
        }
        this.playTrack(newIdx);
    }

    onTrackEnd() {
        if (this.state.repeatMode === 'one') {
            this.playTrack(this.state.currentTrackIndex);
        } else {
            this.nextTrack();
        }
    }

    seek(ev) {
        const percent = ev.target.value;
        const newTime = (percent / 100) * this.state.audio.duration;
        this.state.audio.currentTime = newTime;
    }

    /* ------------------------------------------------------------------ *
     *  UI‑индикаторы
     * ------------------------------------------------------------------ */
    updateProgress() {
        const percent = (this.state.audio.currentTime / this.state.audio.duration) * 100 || 0;
        this.elements.progressBar.value = percent;
        this.elements.currentTime.textContent = this.formatTime(this.state.audio.currentTime);
    }

    updateDuration() {
        this.elements.duration.textContent = this.formatTime(this.state.audio.duration);
        this.elements.progressBar.max = this.state.audio.duration || 100;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    setVolume(ev) {
        const vol = ev.target.value / 100;
        this.state.audio.volume = vol;
        localStorage.setItem('volume', vol);
    }

    updatePlayButton() {
        this.elements.playBtn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }

    /* ------------------------------------------------------------------ *
     *  Shuffle / Repeat
     * ------------------------------------------------------------------ */
    toggleShuffle() {
        this.state.isShuffled = !this.state.isShuffled;
        this.elements.shuffleBtn.style.opacity = this.state.isShuffled ? '1' : '0.5';

        if (this.state.isShuffled) {
            this.state.currentPlaylist = [...this.state.originalPlaylist];
            this.shuffleArray(this.state.currentPlaylist);
        } else {
            this.state.currentPlaylist = [...this.state.originalPlaylist];
        }
        this.saveState();
    }

    toggleRepeat() {
        const modes = ['none', 'one', 'all'];
        const idx = modes.indexOf(this.state.repeatMode);
        this.state.repeatMode = modes[(idx + 1) % modes.length];

        const txt = {
            none: '🔁',
            one:  '🔂',
            all:  '🔁'
        }[this.state.repeatMode];

        this.elements.repeatBtn.textContent = txt;
        this.elements.repeatBtn.style.opacity = this.state.repeatMode === 'none' ? '0.5' : '1';
        this.saveState();
    }

    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    /* ------------------------------------------------------------------ *
     *  Поиск
     * ------------------------------------------------------------------ */
    handleSearch(ev) {
        clearTimeout(this.state.searchTimeout);
        const query = ev.target.value.toLowerCase().trim();

        this.state.searchTimeout = setTimeout(() => {
            if (!query) {
                this.renderAlbums();
                return;
            }

            const found = window.ALBUMS.filter(alb =>
                alb.title.toLowerCase().includes(query) ||
                alb.tracksFile.toLowerCase().includes(query)
            );

            this.elements.albumsGrid.innerHTML = '';
            found.forEach(alb => this.elements.albumsGrid.appendChild(this.createAlbumCard(alb)));
        }, 300);
    }

    /* ------------------------------------------------------------------ *
     *  Горячие клавиши
     * ------------------------------------------------------------------ */
    handleKeydown(ev) {
        if (['INPUT', 'TEXTAREA'].includes(ev.target.tagName)) return;

        switch (ev.key) {
            case ' ':
                ev.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowRight':
                ev.preventDefault();
                this.state.audio.currentTime += 5;
                break;
            case 'ArrowLeft':
                ev.preventDefault();
                this.state.audio.currentTime = Math.max(0, this.state.audio.currentTime - 5);
                break;
            case 'n':
            case 'N':
                ev.preventDefault();
                this.nextTrack();
                break;
            case 'p':
            case 'P':
                ev.preventDefault();
                this.previousTrack();
                break;
            case 's':
            case 'S':
                ev.preventDefault();
                this.toggleShuffle();
                break;
            case 'r':
            case 'R':
                ev.preventDefault();
                this.toggleRepeat();
                break;
        }
    }

    /* ------------------------------------------------------------------ *
     *  Ошибки аудио
     * ------------------------------------------------------------------ */
    handleError(err) {
        console.error('❌ Audio error:', err);
        this.showError('Ошибка воспроизведения');
        this.nextTrack();
    }

    /* ------------------------------------------------------------------ *
     *  UI‑уведомления
     * ------------------------------------------------------------------ */
    showError(msg) {
        const div = document.createElement('div');
        div.className = 'error-message';
        div.textContent = msg;
        div.style.cssText = `
            position:fixed;top:20px;left:50%;transform:translateX(-50%);
            background:#ff4757;color:#fff;padding:10px 20px;
            border-radius:5px;z-index:10000;font-size:14px;
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    /* ------------------------------------------------------------------ *
     *  Сохранение / восстановление состояния
     * ------------------------------------------------------------------ */
    saveState() {
        const s = {
            currentAlbumId: this.state.currentAlbum?.id,
            currentTrackIndex: this.state.currentTrackIndex,
            isShuffled: this.state.isShuffled,
            repeatMode: this.state.repeatMode,
            volume: this.state.audio.volume
        };
        localStorage.setItem('playerState', JSON.stringify(s));
    }

    loadState() {
        const saved = localStorage.getItem('playerState');
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            this.state.isShuffled = data.isShuffled ?? false;
            this.state.repeatMode = data.repeatMode ?? 'all';
            if (typeof data.volume !== 'undefined') {
                this.state.audio.volume = data.volume;
                this.elements.volumeSlider.value = data.volume * 100;
            }

            // UI‑синхронизация
            this.elements.shuffleBtn.style.opacity = this.state.isShuffled ? '1' : '0.5';
            const repeatTxt = {
                none: '🔁',
                one:  '🔂',
                all:  '🔁'
            }[this.state.repeatMode];
            this.elements.repeatBtn.textContent = repeatTxt;
            this.elements.repeatBtn.style.opacity = this.state.repeatMode === 'none' ? '0.5' : '1';
        } catch (e) {
            console.error('❌ Ошибка загрузки состояния:', e);
        }
    }
}

/* --------------------------------------------------------------- *
 *  Запуск
 * --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    new DAJETPlayer();
});
