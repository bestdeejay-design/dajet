// DAJET Music Player - Логика плеера
class DAJETPlayer {
    constructor() {
        // DOM элементы
        this.elements = {
            albumsGrid: document.getElementById('albumsGrid'),
            albumView: document.getElementById('albumView'),
            albumCover: document.getElementById('albumCover'),
            albumTitle: document.getElementById('albumTitle'),
            albumTrackCount: document.getElementById('albumTrackCount'),
            tracksList: document.getElementById('tracksList'),
            backToAlbums: document.getElementById('backToAlbums'),
            currentCover: document.getElementById('currentCover'),
            currentTitle: document.getElementById('currentTitle'),
            currentTime: document.getElementById('currentTime'),
            playBtn: document.getElementById('playBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            repeatBtn: document.getElementById('repeatBtn'),
            shuffleBtn: document.getElementById('shuffleBtn'),
            progressBar: document.getElementById('progressBar'),
            volumeControl: document.getElementById('volumeControl'),
            searchInput: document.getElementById('searchInput'),
            themeToggle: document.getElementById('themeToggle')
        };

        // Состояние плеера
        this.state = {
            currentTrackIndex: -1,
            currentAlbumTracks: [],
            isPlaying: false,
            isShuffled: false,
            repeatMode: 'all', // 'none', 'one', 'all'
            shuffledOrder: [],
            originalOrder: []
        };

        // Аудио элемент
        this.audio = new Audio();
        
        // Таймер для дебаунса поиска
        this.searchTimer = null;

        // Инициализация
        this.init();
    }

    init() {
        this.loadAlbums();
        this.bindEvents();
        this.applyThemeFromStorage();
    }

    loadAlbums() {
        if (!window.ALBUMS) {
            console.error('❌ Не найден массив ALBUMS');
            return;
        }

        this.elements.albumsGrid.innerHTML = '';
        
        window.ALBUMS.forEach(album => {
            const albumCard = this.createAlbumCard(album);
            this.elements.albumsGrid.appendChild(albumCard);
        });
    }

    createAlbumCard(album) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${album.cover || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSIxMDAiIHk9IjEwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+JiN4QTEwO0RBWkVUJiN4QTEwOzwvdGV4dD48L3N2Zz4='}" 
                 alt="${album.title}" 
                 class="album-cover"
                 loading="lazy">
            <div class="album-info">
                <div class="album-title">${album.title}</div>
                <div class="album-track-count">${album.trackCount} треков</div>
            </div>
        `;
        
        card.addEventListener('click', () => this.loadAlbum(album));
        return card;
    }

    async loadAlbum(album) {
        try {
            // Динамическая загрузка треков альбома
            await this.loadAlbumTracks(album.tracksFile);
            
            // Показываем вид альбома
            this.elements.albumsGrid.classList.add('hidden');
            this.elements.albumView.classList.remove('hidden');
            
            // Заполняем информацию об альбоме
            this.elements.albumCover.src = album.cover || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSIxMDAiIHk9IjEwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+JiN4QTEwO0RBWkVUJiN4QTEwOzwvdGV4dD48L3N2Zz4=';
            this.elements.albumTitle.textContent = album.title;
            this.elements.albumTrackCount.textContent = `${this.state.currentAlbumTracks.length} треков`;
            
            // Отображаем треки
            this.renderTracks();
        } catch (error) {
            console.error('❌ Ошибка загрузки альбома:', error);
            alert('Ошибка загрузки альбома. Проверьте консоль для подробностей.');
        }
    }

    async loadAlbumTracks(tracksFile) {
        // Загружаем JS файл с треками
        await import(tracksFile);
        
        // Сохраняем треки
        this.state.currentAlbumTracks = [...window.ALBUM_TRACKS];
        this.state.originalOrder = [...window.ALBUM_TRACKS];
        this.state.shuffledOrder = [...window.ALBUM_TRACKS];
        
        // Перемешиваем если нужно
        if (this.state.isShuffled) {
            this.shuffleTracks();
        }
    }

    renderTracks() {
        this.elements.tracksList.innerHTML = '';
        
        const tracksToShow = this.state.isShuffled ? this.state.shuffledOrder : this.state.originalOrder;
        
        tracksToShow.forEach((track, index) => {
            const trackItem = this.createTrackItem(track, index);
            this.elements.tracksList.appendChild(trackItem);
        });
    }

    createTrackItem(track, index) {
        const item = document.createElement('div');
        item.className = 'track-item';
        item.innerHTML = `
            <img src="${track.cover || this.elements.albumCover.src}" 
                 alt="${track.title}" 
                 class="track-cover"
                 loading="lazy">
            <div class="track-info">
                <div class="track-title">${track.title}</div>
                <div class="track-artist">${track.artist}</div>
            </div>
        `;
        
        item.addEventListener('click', () => this.playTrack(index));
        return item;
    }

    async playTrack(index) {
        const tracks = this.state.isShuffled ? this.state.shuffledOrder : this.state.originalOrder;
        const track = tracks[index];
        
        if (!track) return;
        
        try {
            // Обновляем состояние
            this.state.currentTrackIndex = index;
            
            // Загружаем аудио
            this.audio.src = track.file;
            this.audio.load();
            
            // Обновляем интерфейс
            this.updatePlayerUI(track);
            
            // Воспроизводим
            await this.audio.play();
            this.state.isPlaying = true;
            this.updatePlayButton();
        } catch (error) {
            console.error('❌ Ошибка воспроизведения трека:', error);
            // Переходим к следующему треку при ошибке
            this.nextTrack();
        }
    }

    updatePlayerUI(track) {
        this.elements.currentCover.src = track.cover || this.elements.albumCover.src || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkRBSlRFPC90ZXh0Pjwvc3ZnPg==';
        this.elements.currentTitle.textContent = `${track.title} - ${track.artist}`;
    }

    togglePlay() {
        if (this.state.isPlaying) {
            this.audio.pause();
            this.state.isPlaying = false;
        } else {
            if (this.state.currentTrackIndex === -1 && this.state.currentAlbumTracks.length > 0) {
                // Если ничего не воспроизводится, начать с первого трека
                this.playTrack(0);
                return;
            }
            this.audio.play();
            this.state.isPlaying = true;
        }
        this.updatePlayButton();
    }

    updatePlayButton() {
        this.elements.playBtn.textContent = this.state.isPlaying ? '⏸' : '▶';
    }

    prevTrack() {
        if (this.state.currentTrackIndex === -1) return;
        
        const tracks = this.state.isShuffled ? this.state.shuffledOrder : this.state.originalOrder;
        let newIndex;
        
        // Если проиграно больше 3 секунд, то начинаем трек заново
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        
        // Иначе переходим к предыдущему треку
        newIndex = this.state.currentTrackIndex - 1;
        if (newIndex < 0) {
            newIndex = tracks.length - 1; // Зацикливание
        }
        
        this.playTrack(newIndex);
    }

    nextTrack() {
        if (this.state.currentTrackIndex === -1) return;
        
        const tracks = this.state.isShuffled ? this.state.shuffledOrder : this.state.originalOrder;
        let newIndex = this.state.currentTrackIndex + 1;
        
        if (newIndex >= tracks.length) {
            if (this.state.repeatMode === 'one') {
                // Повтор текущего трека
                this.audio.currentTime = 0;
                this.audio.play();
                return;
            } else if (this.state.repeatMode === 'all') {
                // Повтор плейлиста
                newIndex = 0;
            } else {
                // Нет повтора - останавливаем
                this.audio.pause();
                this.state.isPlaying = false;
                this.updatePlayButton();
                return;
            }
        }
        
        this.playTrack(newIndex);
    }

    toggleShuffle() {
        this.state.isShuffled = !this.state.isShuffled;
        
        if (this.state.isShuffled) {
            this.shuffleTracks();
            this.elements.shuffleBtn.classList.add('active');
        } else {
            this.state.currentAlbumTracks = [...this.state.originalOrder];
            this.elements.shuffleBtn.classList.remove('active');
        }
        
        // Перерисовываем треки если мы в режиме просмотра альбома
        if (!this.elements.albumView.classList.contains('hidden')) {
            this.renderTracks();
        }
    }

    shuffleTracks() {
        // Простой алгоритм перемешивания Fisher-Yates
        this.state.shuffledOrder = [...this.state.originalOrder];
        for (let i = this.state.shuffledOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.state.shuffledOrder[i], this.state.shuffledOrder[j]] = [this.state.shuffledOrder[j], this.state.shuffledOrder[i]];
        }
    }

    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.state.repeatMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.state.repeatMode = modes[nextIndex];
        
        // Обновляем стиль кнопки в зависимости от режима
        this.elements.repeatBtn.classList.remove('active');
        if (this.state.repeatMode !== 'none') {
            this.elements.repeatBtn.classList.add('active');
            this.elements.repeatBtn.textContent = this.state.repeatMode === 'one' ? '🔂' : '🔁';
        } else {
            this.elements.repeatBtn.textContent = '🔁';
        }
    }

    updateProgress() {
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        this.elements.progressBar.value = isNaN(percent) ? 0 : percent;
        
        // Обновляем время
        const current = this.formatTime(this.audio.currentTime);
        const duration = this.formatTime(this.audio.duration);
        this.elements.currentTime.textContent = `${current} / ${duration || '0:00'}`;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    seek(e) {
        const pos = (e.offsetX / e.target.offsetWidth) * 100;
        this.elements.progressBar.value = pos;
        this.audio.currentTime = (pos / 100) * this.audio.duration;
    }

    setVolume() {
        this.audio.volume = this.elements.volumeControl.value;
    }

    backToAlbums() {
        this.elements.albumView.classList.add('hidden');
        this.elements.albumsGrid.classList.remove('hidden');
    }

    search(query) {
        query = query.toLowerCase().trim();
        
        if (!query) {
            this.loadAlbums();
            return;
        }
        
        // Поиск по альбомам и трекам
        const filteredAlbums = window.ALBUMS.filter(album => 
            album.title.toLowerCase().includes(query)
        );
        
        // Показываем только подходящие альбомы
        this.elements.albumsGrid.innerHTML = '';
        
        filteredAlbums.forEach(album => {
            const albumCard = this.createAlbumCard(album);
            this.elements.albumsGrid.appendChild(albumCard);
        });
        
        // Также ищем треки во всех альбомах (если уже загружены)
        if (window.ALBUMS) {
            const matchingTracks = [];
            
            // Это базовый поиск - в реальном приложении можно кэшировать треки
            // для более эффективного поиска
        }
    }

    debounceSearch(query) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.search(query);
        }, 300); // 300ms задержка
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        // Обновляем иконку
        this.elements.themeToggle.textContent = isDark ? '☀️' : '🌙';
    }

    applyThemeFromStorage() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const isDark = savedTheme === 'dark' || (savedTheme === null && prefersDark);
        
        if (isDark) {
            document.body.classList.add('dark-theme');
            this.elements.themeToggle.textContent = '☀️';
        }
    }

    bindEvents() {
        // Кнопки плеера
        this.elements.playBtn.addEventListener('click', () => this.togglePlay());
        this.elements.prevBtn.addEventListener('click', () => this.prevTrack());
        this.elements.nextBtn.addEventListener('click', () => this.nextTrack());
        this.elements.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.elements.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        
        // Прогресс и громкость
        this.elements.progressBar.addEventListener('input', () => {
            const time = (this.elements.progressBar.value / 100) * this.audio.duration;
            this.audio.currentTime = time;
        });
        
        this.elements.progressBar.addEventListener('click', (e) => this.seek(e));
        this.elements.volumeControl.addEventListener('input', () => this.setVolume());
        
        // Кнопка назад
        this.elements.backToAlbums.addEventListener('click', () => this.backToAlbums());
        
        // Поиск
        this.elements.searchInput.addEventListener('input', (e) => {
            this.debounceSearch(e.target.value);
        });
        
        // Переключение темы
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // События аудио
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.nextTrack());
        this.audio.addEventListener('error', () => {
            console.error('❌ Ошибка воспроизведения аудио');
            // Переходим к следующему треку
            this.nextTrack();
        });
        
        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return; // Не работаем когда в фокусе инпут
            
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.audio.currentTime += 5; // Перемотка +5 сек
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.audio.currentTime -= 5; // Перемотка -5 сек
                    break;
                case 'n':
                case 'N':
                    e.preventDefault();
                    this.nextTrack();
                    break;
                case 'p':
                case 'P':
                    e.preventDefault();
                    this.prevTrack();
                    break;
            }
        });
    }
}

// Инициализация плеера при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new DAJETPlayer();
});