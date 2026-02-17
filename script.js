// DAJET Music Player - Логика плеера
class DAJETPlayer {
    constructor() {
        // DOM элементы
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

        // Состояние плеера
        this.state = {
            currentAlbum: null,
            currentTrackIndex: 0,
            isPlaying: false,
            isShuffled: false,
            repeatMode: 'all', // 'none', 'one', 'all'
            currentPlaylist: [],
            originalPlaylist: [],
            audio: new Audio(),
            searchTimeout: null
        };

        // Инициализация
        this.init();
    }

    init() {
        // Загрузка сохранённой темы
        this.loadTheme();

        // Загрузка альбомов
        this.loadAlbums();

        // Обработчики событий
        this.bindEvents();

        // Загрузка состояния из localStorage
        this.loadState();
    }

    loadTheme() {
        // Используем ThemeManager для получения текущей темы
        if (window.ThemeManager && typeof window.ThemeManager.getTheme === 'function') {
            const currentTheme = window.ThemeManager.getTheme();
            if (currentTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else if (currentTheme === 'lounge') {
                document.documentElement.setAttribute('data-theme', 'lounge');
            }
        }
    }

    bindEvents() {
        // Переключение темы - теперь через ThemeManager
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Поиск
        this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e));

        // Навигация
        this.elements.backToAlbums.addEventListener('click', () => this.showAlbums());

        // Управление плеером
        this.elements.playBtn.addEventListener('click', () => this.togglePlay());
        this.elements.stopBtn.addEventListener('click', () => this.stop());
        this.elements.prevBtn.addEventListener('click', () => this.previousTrack());
        this.elements.nextBtn.addEventListener('click', () => this.nextTrack());
        this.elements.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.elements.repeatBtn.addEventListener('click', () => this.toggleRepeat());

        // Прогресс и громкость
        this.elements.progressBar.addEventListener('input', (e) => this.seek(e));
        this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e));

        // События аудио
        this.state.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.state.audio.addEventListener('ended', () => this.onTrackEnd());
        this.state.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.state.audio.addEventListener('error', (e) => this.handleError(e));

        // Горячие клавиши
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // События для интеграции со стробоскопом
        this.setupStrobeIntegration();
    }

    setupStrobeIntegration() {
        // Интеграция с модулем стробоскопа
        document.addEventListener('music:play', () => {
            if (window.StrobeEffect) {
                window.StrobeEffect.play();
            }
        });

        document.addEventListener('music:pause', () => {
            if (window.StrobeEffect) {
                window.StrobeEffect.pause();
            }
        });

        document.addEventListener('music:stop', () => {
            if (window.StrobeEffect) {
                window.StrobeEffect.stop();
            }
        });
    }

    toggleTheme() {
        // Используем ThemeManager для переключения тем
        if (window.ThemeManager && typeof window.ThemeManager.toggle === 'function') {
            window.ThemeManager.toggle();
        }
        
        // Уведомляем стробоскоп о смене темы
        if (window.StrobeEffect && window.StrobeEffect.onThemeChange) {
            window.StrobeEffect.onThemeChange();
        }
    }

    async loadAlbums() {
        // Check if ALBUMS is already loaded
        if (typeof window.ALBUMS === 'undefined' || !Array.isArray(window.ALBUMS)) {
            try {
                // Fetch the albums.js file content
                const response = await fetch('data/albums.js');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const text = await response.text();
                
                // Extract the ALBUMS array using regex and JSON.parse
                // Find the array between const ALBUMS = [ ... ];
                const regex = /const\s+ALBUMS\s*=\s*(\[.*?\]);/s;
                const match = text.match(regex);
                
                if (match && match[1]) {
                    window.ALBUMS = JSON.parse(match[1]);
                } else {
                    throw new Error('Could not find ALBUMS array in the fetched data');
                }
                
                if (!Array.isArray(window.ALBUMS)) {
                    throw new Error('ALBUMS is not an array');
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки и парсинга файла albums.js:', error);
                this.showError('Ошибка: не удалось загрузить и обработать файл с альбомами');
                return;
            }
        }

        this.renderAlbums();
    }

    createAlbumCard(album) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${album.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMTAwIiBmaWxsPSIjMzU1N2FhIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTA1IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI0OCIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pgo8L3N2Zz4K'}" 
                 alt="${album.title}" class="album-cover" loading="lazy">
            <div class="album-info-card">
                <h3 class="album-title">${this.escapeHtml(album.title)}</h3>
                <p class="album-track-count">${album.trackCount} треков</p>
            </div>
        `;
        
        card.addEventListener('click', () => this.loadAlbumTracks(album));
        return card;
    }

    renderAlbums() {
        this.elements.albumsGrid.innerHTML = '';

        for (const album of window.ALBUMS) {
            const albumCard = this.createAlbumCard(album);
            this.elements.albumsGrid.appendChild(albumCard);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadAlbumTracks(album) {
    try {
        // Загрузка содержимого JS-файла с треками через fetch
        const response = await fetch(album.tracksFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsContent = await response.text();

        // Извлечение массива треков с помощью регулярного выражения
        const regex = /const\s+ALBUM_TRACKS\s*=\s*(\[.*?\]);/s;
        const match = jsContent.match(regex);

        if (!match || !match[1]) {
            console.error(`❌ Не найден массив ALBUM_TRACKS в файле ${album.tracksFile}`);
            this.showError(`Не удалось загрузить треки альбома: ${album.title}`);
            return;
        }

        // Парсинг JSON для получения массива треков
        const tracks = JSON.parse(match[1]);

        if (!Array.isArray(tracks)) {
            throw new Error('Треки не являются массивом');
        }

        // Обновление состояния плеера
        this.state.currentAlbum = album;
        this.state.currentPlaylist = [...tracks];
        this.state.originalPlaylist = [...tracks];

        // Отображение треков в интерфейсе
        this.displayAlbumTracks(album, tracks);
        this.showAlbumView();

    } catch (error) {
        console.error('Ошибка при загрузке треков альбома:', error);
        this.showError(`Не удалось загрузить треки альбома: ${album.title}`);
    }
}

    displayAlbumTracks(album, tracks) {
        this.elements.albumCover.src = album.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9Ijc1IiBmaWxsPSIjMzU1N2FhIi8+Cjx0ZXh0IHg9Ijc1IiB5PSI4MCIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMzYiIGZvbnQtZmFtaWx5PSJBcmlhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RDwvdGV4dD4KPC9zdmc+Cg==';
        this.elements.albumTitle.textContent = album.title;
        this.elements.albumTrackCount.textContent = `${tracks.length} треков`;

        this.elements.tracksList.innerHTML = '';
        
        tracks.forEach((track, index) => {
            const trackItem = document.createElement('div');
            trackItem.className = 'track-item';
            trackItem.innerHTML = `
                <span class="track-number">${index + 1}.</span>
                <img src="${track.cover || album.cover || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzNTU3YWEiLz4KPHRleHQgeD0iMjAiIHk9IjIzIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pgo8L3N2Zz4K'}" 
                     alt="${track.title}" class="track-cover" loading="lazy">
                <div class="track-details">
                    <div class="track-title">${this.escapeHtml(track.title)}</div>
                    <div class="track-artist">${this.escapeHtml(track.artist)}</div>
                </div>
            `;
            
            trackItem.addEventListener('click', () => this.playTrack(index));
            this.elements.tracksList.appendChild(trackItem);
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

    playTrack(index) {
        if (index < 0 || index >= this.state.currentPlaylist.length) {
            return;
        }

        const track = this.state.currentPlaylist[index];
        this.state.currentTrackIndex = index;

        try {
            // Загрузка трека
            this.state.audio.src = track.file;
            this.state.audio.load();

            // Обновление информации о треке
            this.elements.currentTrackTitle.textContent = track.title;
            this.elements.currentTrackArtist.textContent = track.artist;
            this.elements.currentTrackCover.src = track.cover || 
                                                 this.state.currentAlbum?.cover || 
                                                 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiMzNTU3YWEiLz4KPHRleHQgeD0iMzIiIHk9IjM2IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNiIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0Pgo8L3N2Zz4K';

            // Воспроизведение
            this.state.audio.play();
            this.state.isPlaying = true;
            this.updatePlayButton();

            // Отправляем событие воспроизведения для стробоскопа
            document.dispatchEvent(new CustomEvent('music:play'));

            // Показ плеера
            this.elements.player.classList.remove('hidden');

            // Сохранение состояния
            this.saveState();
        } catch (error) {
            console.error('Ошибка при воспроизведении трека:', error);
            this.showError('Не удалось воспроизвести трек');
            // Переход к следующему треку
            this.nextTrack();
        }
    }

    togglePlay() {
        if (this.state.isPlaying) {
            this.state.audio.pause();
            // Отправляем событие паузы для стробоскопа
            document.dispatchEvent(new CustomEvent('music:pause'));
        } else {
            if (this.state.audio.src) {
                this.state.audio.play();
                // Отправляем событие воспроизведения для стробоскопа
                document.dispatchEvent(new CustomEvent('music:play'));
            } else if (this.state.currentPlaylist.length > 0) {
                this.playTrack(this.state.currentTrackIndex);
                // Событие воспроизведения отправляется в playTrack
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
        // Отправляем событие остановки для стробоскопа
        document.dispatchEvent(new CustomEvent('music:stop'));
    }

    previousTrack() {
        if (this.state.currentPlaylist.length === 0) return;

        // Если прошло больше 3 секунд, начать трек заново
        if (this.state.audio.currentTime > 3) {
            this.state.audio.currentTime = 0;
            return;
        }

        let newIndex = this.state.currentTrackIndex - 1;
        if (newIndex < 0) {
            if (this.state.repeatMode === 'all') {
                newIndex = this.state.currentPlaylist.length - 1;
            } else {
                newIndex = 0;
                this.stop();
                return;
            }
        }

        this.playTrack(newIndex);
    }

    nextTrack() {
        if (this.state.currentPlaylist.length === 0) return;

        let newIndex = this.state.currentTrackIndex + 1;
        if (newIndex >= this.state.currentPlaylist.length) {
            if (this.state.repeatMode === 'all') {
                newIndex = 0;
            } else {
                this.stop();
                return;
            }
        }

        this.playTrack(newIndex);
    }

    onTrackEnd() {
        if (this.state.repeatMode === 'one') {
            this.playTrack(this.state.currentTrackIndex);
        } else {
            this.nextTrack();
        }
    }

    seek(event) {
        const seekTime = (event.target.value / 100) * this.state.audio.duration;
        this.state.audio.currentTime = seekTime;
    }

    updateProgress() {
        const percent = (this.state.audio.currentTime / this.state.audio.duration) * 100 || 0;
        this.elements.progressBar.value = percent;
        this.elements.currentTime.textContent = this.formatTime(this.state.audio.currentTime);
    }

    updateDuration() {
        this.elements.duration.textContent = this.formatTime(this.state.audio.duration);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    setVolume(event) {
        const volume = event.target.value / 100;
        this.state.audio.volume = volume;
        localStorage.setItem('volume', volume);
    }

    loadState() {
        const savedVolume = localStorage.getItem('volume');
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            this.state.audio.volume = volume;
            this.elements.volumeSlider.value = volume * 100;
        }
    }

    saveState() {
        localStorage.setItem('currentTrackIndex', this.state.currentTrackIndex);
        localStorage.setItem('currentAlbum', JSON.stringify(this.state.currentAlbum));
        localStorage.setItem('isPlaying', this.state.isPlaying);
    }

    toggleShuffle() {
        this.state.isShuffled = !this.state.isShuffled;
        this.elements.shuffleBtn.style.opacity = this.state.isShuffled ? '1' : '0.5';
        
        if (this.state.isShuffled) {
            // Перемешиваем плейлист
            this.state.currentPlaylist = [...this.state.originalPlaylist];
            this.shuffleArray(this.state.currentPlaylist);
        } else {
            // Возвращаем оригинальный порядок
            this.state.currentPlaylist = [...this.state.originalPlaylist];
        }
    }

    toggleRepeat() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.state.repeatMode);
        this.state.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        this.elements.repeatBtn.textContent = {
            'none': '🔁',
            'one': '🔂',
            'all': '🔁'
        }[this.state.repeatMode];
        
        this.elements.repeatBtn.style.opacity = this.state.repeatMode === 'none' ? '0.5' : '1';
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    handleSearch(event) {
        clearTimeout(this.state.searchTimeout);
        const query = event.target.value.toLowerCase().trim();
        
        this.state.searchTimeout = setTimeout(() => {
            if (query.length === 0) {
                this.renderAlbums();
                return;
            }

            const filteredAlbums = window.ALBUMS.filter(album => 
                album.title.toLowerCase().includes(query) ||
                album.tracksFile.toLowerCase().includes(query)
            );

            this.elements.albumsGrid.innerHTML = '';
            filteredAlbums.forEach(album => {
                const albumCard = this.createAlbumCard(album);
                this.elements.albumsGrid.appendChild(albumCard);
            });
        }, 300);
    }

    handleKeydown(event) {
        // Горячие клавиши для управления плеером
        switch(event.code) {
            case 'Space':
                if (event.target.tagName !== 'INPUT') {
                    event.preventDefault();
                    this.togglePlay();
                }
                break;
            case 'ArrowLeft':
                if (event.target.tagName !== 'INPUT') {
                    event.preventDefault();
                    this.previousTrack();
                }
                break;
            case 'ArrowRight':
                if (event.target.tagName !== 'INPUT') {
                    event.preventDefault();
                    this.nextTrack();
                }
                break;
            case 'ArrowUp':
                if (event.target.tagName !== 'INPUT') {
                    event.preventDefault();
                    const newVolume = Math.min(1, this.state.audio.volume + 0.1);
                    this.state.audio.volume = newVolume;
                    this.elements.volumeSlider.value = newVolume * 100;
                }
                break;
            case 'ArrowDown':
                if (event.target.tagName !== 'INPUT') {
                    event.preventDefault();
                    const newVolume = Math.max(0, this.state.audio.volume - 0.1);
                    this.state.audio.volume = newVolume;
                    this.elements.volumeSlider.value = newVolume * 100;
                }
                break;
        }
    }

    handleError(error) {
        console.error('Ошибка аудио:', error);
        this.showError('Ошибка воспроизведения аудио');
        this.nextTrack(); // Переход к следующему треку при ошибке
    }

    showError(message) {
        // Создание всплывающего сообщения об ошибке
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4757;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    updatePlayButton() {
        this.elements.playBtn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }
}

// Инициализация плеера после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new DAJETPlayer();
});

    setVolume(event) {
        this.state.audio.volume = event.target.value / 100;
    }

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

    updatePlayButton() {
        this.elements.playBtn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }

    toggleShuffle() {
        this.state.isShuffled = !this.state.isShuffled;
        this.elements.shuffleBtn.style.background = this.state.isShuffled ? '#ff6b6b' : '';
        
        if (this.state.isShuffled) {
            // Перемешивание плейлиста
            this.shufflePlaylist();
        } else {
            // Возврат к оригинальному порядку
            this.state.currentPlaylist = [...this.state.originalPlaylist];
            // Обновление списка треков в UI
            if (this.state.currentAlbum) {
                this.displayAlbumTracks(this.state.currentAlbum, this.state.currentPlaylist);
            }
        }
        
        this.saveState();
    }

    shufflePlaylist() {
        // Простой алгоритм перемешивания (Fisher-Yates)
        const playlist = [...this.state.originalPlaylist];
        for (let i = playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
        }
        this.state.currentPlaylist = playlist;
        
        // Обновление списка треков в UI
        if (this.state.currentAlbum) {
            this.displayAlbumTracks(this.state.currentAlbum, this.state.currentPlaylist);
        }
    }

    toggleRepeat() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.state.repeatMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.state.repeatMode = modes[nextIndex];
        
        // Обновление визуального состояния кнопки
        this.elements.repeatBtn.textContent = this.state.repeatMode === 'none' ? '🔁' : 
                                              this.state.repeatMode === 'one' ? '🔂' : '🔁';
        this.elements.repeatBtn.style.background = this.state.repeatMode === 'none' ? '' : 
                                                   this.state.repeatMode === 'one' ? '#ff6b6b' : '#4ecdc4';
        
        this.saveState();
    }

    handleSearch(event) {
        // Отмена предыдущего таймера
        if (this.state.searchTimeout) {
            clearTimeout(this.state.searchTimeout);
        }

        // Установка нового таймера для дебаунса
        this.state.searchTimeout = setTimeout(() => {
            this.performSearch(event.target.value);
        }, 300);
    }

    performSearch(query) {
        query = query.toLowerCase().trim();
        if (!query) {
            this.loadAlbums();
            return;
        }

        // Поиск по альбомам и трекам
        const filteredAlbums = [];
        
        if (window.ALBUMS && Array.isArray(window.ALBUMS)) {
            for (const album of window.ALBUMS) {
                // Проверка названия альбома
                if (album.title.toLowerCase().includes(query)) {
                    filteredAlbums.push(album);
                    continue;
                }

                // Загрузка треков альбома для поиска по названиям треков
                fetch(album.tracksFile)
                    .then(response => response.text())
                    .then(jsCode => {
                        // Извлечение данных из JS файла
                        const match = jsCode.match(/const ALBUM_TRACKS = (\[.*?\]);/s);
                        if (match) {
                            try {
                                const tracks = JSON.parse(match[1]);
                                const matchingTracks = tracks.filter(track => 
                                    track.title.toLowerCase().includes(query)
                                );
                                
                                if (matchingTracks.length > 0) {
                                    // Добавляем альбом с информацией о совпадающих треках
                                    const filteredAlbum = {...album};
                                    filteredAlbum.filteredTracks = matchingTracks;
                                    filteredAlbums.push(filteredAlbum);
                                }
                            } catch (e) {
                                console.error('Ошибка парсинга треков:', e);
                            }
                        }
                    })
                    .catch(err => console.error('Ошибка загрузки треков:', err));
            }
        }

        // Отображение результатов поиска
        this.displaySearchResults(filteredAlbums, query);
    }

    displaySearchResults(albums, query) {
        this.elements.albumsGrid.innerHTML = '';
        
        if (albums.length === 0) {
            this.elements.albumsGrid.innerHTML = '<p>Ничего не найдено</p>';
            return;
        }

        for (const album of albums) {
            const albumCard = this.createAlbumCard({
                ...album,
                title: `${album.title} (найдено: ${album.filteredTracks ? album.filteredTracks.length : album.trackCount})`
            });
            this.elements.albumsGrid.appendChild(albumCard);
        }
    }

    handleKeydown(event) {
        // Только если не в поле ввода
        if (event.target.tagName === 'INPUT') return;

        switch (event.key) {
            case ' ':
                event.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.state.audio.currentTime += 5;
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.state.audio.currentTime -= 5;
                break;
            case 'n':
            case 'N':
                event.preventDefault();
                this.nextTrack();
                break;
            case 'p':
            case 'P':
                event.preventDefault();
                this.previousTrack();
                break;
        }
    }

    handleError(error) {
        console.error('Ошибка аудио:', error);
        // Переход к следующему треку при ошибке
        this.nextTrack();
    }

    showError(message) {
        // Создание элемента ошибки
        const errorDiv = document.createElement('div');
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff6b6b;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Удаление через 3 секунды
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    saveState() {
        const state = {
            currentAlbumId: this.state.currentAlbum?.id,
            currentTrackIndex: this.state.currentTrackIndex,
            isShuffled: this.state.isShuffled,
            repeatMode: this.state.repeatMode,
            volume: this.state.audio.volume
        };
        localStorage.setItem('playerState', JSON.stringify(state));
    }

    loadState() {
        const savedState = localStorage.getItem('playerState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.state.isShuffled = state.isShuffled || false;
                this.state.repeatMode = state.repeatMode || 'all';
                if (typeof state.volume !== 'undefined') {
                    this.state.audio.volume = state.volume;
                    this.elements.volumeSlider.value = state.volume * 100;
                }
                
                // Обновление UI в соответствии с сохранённым состоянием
                this.elements.shuffleBtn.style.background = this.state.isShuffled ? '#ff6b6b' : '';
                this.elements.repeatBtn.textContent = state.repeatMode === 'none' ? '🔁' : 
                                                      state.repeatMode === 'one' ? '🔂' : '🔁';
                this.elements.repeatBtn.style.background = state.repeatMode === 'none' ? '' : 
                                                          state.repeatMode === 'one' ? '#ff6b6b' : '#4ecdc4';
            } catch (e) {
                console.error('Ошибка загрузки сохраненного состояния:', e);
            }
        }
    }
}

// Инициализация плеера при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new DAJETPlayer();
});
