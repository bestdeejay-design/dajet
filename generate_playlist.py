import os
import json
from datetime import datetime

def load_config():
    """Загрузка конфигурации из config.json"""
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Ошибка: файл config.json не найден")
        return None
    except json.JSONDecodeError:
        print("❌ Ошибка: файл config.json содержит некорректный JSON")
        return None

def find_album_cover(album_path, config):
    """Поиск обложки альбома"""
    for cover_name in config['coverNames']:
        for ext in config['supportedImages']:
            cover_path = os.path.join(album_path, f"{cover_name}{ext}")
            if os.path.exists(cover_path):
                return cover_path
    return None

def find_track_images(track_path, config):
    """Поиск индивидуальной обложки для трека"""
    base_name = os.path.splitext(track_path)[0]
    for ext in config['supportedImages']:
        image_path = f"{base_name}{ext}"
        if os.path.exists(image_path):
            return image_path
    return None

def scan_albums(config):
    """Сканирование папки с альбомами"""
    albums_folder = config['albumsFolder']
    if not os.path.exists(albums_folder):
        print(f"❌ Ошибка: папка {albums_folder} не найдена")
        return []
    
    albums = []
    for album_dir in os.listdir(albums_folder):
        album_path = os.path.join(albums_folder, album_dir)
        
        # Пропускаем файлы, обрабатываем только подкаталоги
        if not os.path.isdir(album_path):
            continue
        
        # Ищем аудиофайлы в альбоме
        audio_files = []
        for file in os.listdir(album_path):
            file_ext = os.path.splitext(file)[1].lower()
            if file_ext in config['supportedAudio']:
                audio_files.append(file)
        
        if len(audio_files) == 0:
            print(f"⚠️  Альбом '{album_dir}' не содержит аудиофайлов")
            continue
        
        # Сортируем файлы для предсказуемого порядка
        audio_files.sort()
        
        # Ищем обложку альбома
        cover_path = find_album_cover(album_path, config)
        
        album_info = {
            'id': album_dir.lower().replace(' ', '-').replace('_', '-'),
            'title': album_dir,
            'path': album_path,
            'cover': cover_path,
            'tracks': [],
            'track_count': len(audio_files)
        }
        
        # Создаем информацию о треках
        for audio_file in audio_files:
            track_path = os.path.join(album_path, audio_file)
            track_image = find_track_images(track_path, config)
            
            track_info = {
                'title': os.path.splitext(audio_file)[0],
                'file': track_path,
                'cover': track_image,
                'artist': config['defaultArtist']
            }
            album_info['tracks'].append(track_info)
        
        albums.append(album_info)
        print(f"✅ Найден альбом '{album_dir}' с {len(audio_files)} треками")
        
        if not cover_path:
            print(f"⚠️  У альбома '{album_dir}' отсутствует обложка")
    
    return albums

def generate_albums_js(albums, config):
    """Генерация основного файла albums.js"""
    output_folder = config['outputFolder']
    os.makedirs(output_folder, exist_ok=True)
    
    albums_data = []
    for album in albums:
        album_entry = {
            'id': album['id'],
            'title': album['title'],
            'path': album['path'],
            'cover': album['cover'] if album['cover'] else None,
            'tracksFile': f"data/albums/{album['title']}.js",
            'trackCount': album['track_count']
        }
        albums_data.append(album_entry)
    
    output_path = os.path.join(output_folder, 'albums.js')
    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"// Авто-генерация: {timestamp}\n")
        f.write("// Не редактируйте вручную — изменения будут перезаписаны\n\n")
        f.write("const ALBUMS = ")
        json.dump(albums_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    
    print(f"✅ Сгенерирован файл {output_path}")

def generate_album_tracks_js(albums, config):
    """Генерация файлов с треками для каждого альбома"""
    output_folder = os.path.join(config['outputFolder'], 'albums')
    os.makedirs(output_folder, exist_ok=True)
    
    for album in albums:
        tracks_output_path = os.path.join(output_folder, f"{album['title']}.js")
        timestamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        
        with open(tracks_output_path, 'w', encoding='utf-8') as f:
            f.write(f"// Авто-генерация: {timestamp}\n")
            f.write(f"// Альбом: {album['title']}\n")
            f.write("// Не редактируйте вручную — изменения будут перезаписаны\n\n")
            f.write("const ALBUM_TRACKS = ")
            json.dump(album['tracks'], f, ensure_ascii=False, indent=2)
            f.write(";\n")
        
        print(f"✅ Сгенерирован файл {tracks_output_path}")

def main():
    print("🎵 Запуск генератора плейлиста...")
    
    config = load_config()
    if not config:
        return
    
    albums = scan_albums(config)
    
    if not albums:
        print("❌ Не найдено ни одного альбома с аудиофайлами")
        return
    
    generate_albums_js(albums, config)
    generate_album_tracks_js(albums, config)
    
    total_tracks = sum(album['track_count'] for album in albums)
    print("\n📊 ИТОГО:")
    print(f"   Альбомов: {len(albums)}")
    print(f"   Треков: {total_tracks}")
    print("✅ Генерация завершена успешно!")

if __name__ == "__main__":
    main()