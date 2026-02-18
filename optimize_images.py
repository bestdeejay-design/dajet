#!/usr/bin/env python3
"""
Скрипт для оптимизации изображений в проекте
"""
import os
from PIL import Image
import argparse

def optimize_image(input_path, output_path, quality=80, max_size=(1920, 1080)):
    """
    Оптимизирует одно изображение
    
    Args:
        input_path: путь к исходному изображению
        output_path: путь для сохранения оптимизированного изображения
        quality: качество JPEG (1-100)
        max_size: максимальный размер изображения
    """
    try:
        with Image.open(input_path) as img:
            # Преобразуем в RGB если изображение в режиме RGBA
            if img.mode in ('RGBA', 'LA', 'P'):
                # Создаем белый фон для прозрачных изображений
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ('RGBA', 'LA'):
                    background.paste(img, mask=img.split()[-1])  # Используем альфа-канал как маску
                    img = background
            else:
                img = img.convert('RGB')
            
            # Изменяем размер если изображение больше max_size
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Сохраняем с заданным качеством
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
            original_size = os.path.getsize(input_path)
            optimized_size = os.path.getsize(output_path)
            
            print(f"Оптимизировано: {input_path}")
            print(f"  Размер: {original_size:,} байт -> {optimized_size:,} байт ({(1 - optimized_size/original_size)*100:.1f}% сжатия)")
            
    except Exception as e:
        print(f"Ошибка при оптимизации {input_path}: {e}")

def main():
    parser = argparse.ArgumentParser(description='Оптимизация изображений в проекте')
    parser.add_argument('--quality', type=int, default=80, help='Качество JPEG (по умолчанию 80)')
    parser.add_argument('--max-width', type=int, default=1920, help='Максимальная ширина (по умолчанию 1920)')
    parser.add_argument('--max-height', type=int, default=1080, help='Максимальная высота (по умолчанию 1080)')
    
    args = parser.parse_args()
    
    # Находим все изображения в проекте
    image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']
    images_found = []
    
    for root, dirs, files in os.walk('/workspace'):
        for file in files:
            if any(file.lower().endswith(ext) for ext in image_extensions):
                if not root.startswith('/workspace/optimized_images'):  # Исключаем папку с оптимизированными изображениями
                    images_found.append(os.path.join(root, file))
    
    print(f"Найдено {len(images_found)} изображений для оптимизации")
    
    # Оптимизируем каждое изображение
    for input_path in images_found:
        # Создаем путь для сохранения в папке optimized_images
        relative_path = os.path.relpath(input_path, '/workspace')
        output_path = os.path.join('/workspace/optimized_images', relative_path)
        
        # Убедимся, что директория существует
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Заменяем расширение на .jpg для всех изображений
        output_path = os.path.splitext(output_path)[0] + '.jpg'
        
        optimize_image(input_path, output_path, args.quality, (args.max_width, args.max_height))

if __name__ == "__main__":
    main()