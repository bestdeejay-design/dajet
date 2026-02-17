import os
import json
from datetime import datetime
import re

def load_config():
    """Загрузка конфигурации из config.json"""
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Файл config.json не найден")
        return None
    except json.JSONDecodeError:
        print("❌ Ошибка в формате config.json")
        return None

def find_album_cover(album_path, config):
    """Поиск обложки альбома"""
    for cover_name in config['coverNames']:
        for ext in config['supportedImages']:
            cover_file = f"{cover_name}{ext}"
            cover_path = os.path.join(album_path, cover_file)
            if os.path.exists(cover_path):
                return cover_path
    return None

def find_track_images(track_files, album_path, config):
    """Поиск индивидуальных обложек для треков"""
    track_images = {}
    for track_file in track_files:
        track_name = os.path.splitext(track_file)[0]
        for ext in config['supportedImages']:
            image_file = f"{track_name}{ext}"
            image_path = os.path.join(album_path, image_file)
            if os.path.exists(image_path):
                track_images[track_file] = image_path
                break
    return track_images

def scan_albums(config):
    """Сканирование папки с альбомами"""
    albums_folder = config['albumsFolder']
    if not os.path.exists(albums_folder):
        print(f"❌ Папка {albums_folder} не найдена")
        return []

    albums = []
    
    for album_dir in os.listdir(albums_folder):
        album_path = os.path.join(albums_folder, album_dir)
        
        # Пропускаем, если не директория
        if not os.path.isdir(album_path):
            continue
            
        # Поиск аудиофайлов
        audio_files = []
        for file in os.listdir(album_path):
            file_ext = os.path.splitext(file)[1].lower()
            if file_ext in config['supportedAudio']:
                audio_files.append(file)
                
        if not audio_files:
            print(f"⚠️  В альбоме '{album_dir}' не найдено аудиофайлов")
            continue
            
        # Поиск обложки альбома
        cover_path = find_album_cover(album_path, config)
        if not cover_path:
            print(f"⚠️  У альбома '{album_dir}' отсутствует обложка")
            
        # Сортировка аудиофайлов для более предсказуемого порядка
        audio_files.sort()
        
        album_data = {
            'id': re.sub(r'[^a-zA-Z0-9_-]', '-', album_dir),
            'title': album_dir,
            'path': f"{albums_folder}/{album_dir}",
            'cover': cover_path.replace('\\', '/') if cover_path else None,
            'tracksFile': f"data/albums/{album_dir}.js",
            'trackCount': len(audio_files)
        }
        
        albums.append(album_data)
        print(f"✅ Найден альбом '{album_dir}' с {len(audio_files)} треками")
        
    return albums

def generate_album_tracks(album_path, album_title, config):
    """Генерация JS-файла с треками альбома"""
    audio_files = []
    for file in os.listdir(album_path):
        file_ext = os.path.splitext(file)[1].lower()
        if file_ext in config['supportedAudio']:
            audio_files.append(file)
    
    # Сортировка для предсказуемого порядка
    audio_files.sort()
    
    # Поиск индивидуальных обложек для треков
    track_images = find_track_images(audio_files, album_path, config)
    
    tracks = []
    for audio_file in audio_files:
        track_name = os.path.splitext(audio_file)[0]
        # Улучшенная обработка названия трека (убираем нумерацию в начале)
        clean_title = re.sub(r'^\d{1,3}[ _\-\.]*', '', track_name).strip()
        if not clean_title:
            clean_title = track_name
        
        track_data = {
            'title': clean_title,
            'file': f"{album_path}/{audio_file}".replace('\\', '/'),
            'cover': track_images.get(audio_file),
            'artist': config['defaultArtist']
        }
        tracks.append(track_data)
    
    # Создание папки data/albums если не существует
    output_dir = os.path.join(config['outputFolder'], 'albums')
    os.makedirs(output_dir, exist_ok=True)
    
    # Генерация JS файла
    output_file = os.path.join(output_dir, f"{os.path.basename(album_path)}.js")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"// Авто-генерация: {timestamp}\n")
        f.write(f"// Альбом: {album_title}\n")
        f.write("// Не редактируйте вручную — изменения будут перезаписаны\n\n")
        f.write("const ALBUM_TRACKS = ")
        json.dump(tracks, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    return output_file

def main():
    print("🎵 Запуск генератора плейлиста...")
    
    config = load_config()
    if not config:
        return
    
    # Сканирование альбомов
    albums = scan_albums(config)
    
    if not albums:
        print("❌ Альбомы не найдены")
        return
    
    # Создание папки data если не существует
    os.makedirs(config['outputFolder'], exist_ok=True)
    
    # Генерация JS файла для каждого альбома
    for album in albums:
        album_path = os.path.join(config['albumsFolder'], album['title'])
        try:
            track_file = generate_album_tracks(album_path, album['title'], config)
            print(f"✅ Сгенерирован файл треков: {track_file}")
        except Exception as e:
            print(f"❌ Ошибка при генерации треков для альбома {album['title']}: {str(e)}")
    
    # Генерация общего файла albums.js
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    albums_js_path = os.path.join(config['outputFolder'], 'albums.js')
    
    with open(albums_js_path, 'w', encoding='utf-8') as f:
        f.write(f"// Авто-генерация: {timestamp}\n")
        f.write("// Не редактируйте вручную — изменения будут перезаписаны\n\n")
        f.write("const ALBUMS = ")
        json.dump(albums, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    print(f"✅ Сгенерирован основной файл: {albums_js_path}")
    
    # Итоговая статистика
    total_tracks = sum(album['trackCount'] for album in albums)
    print(f"\n📊 Итоговая статистика:")
    print(f"   Альбомов: {len(albums)}")
    print(f"   Всего треков: {total_tracks}")

if __name__ == "__main__":
    main()