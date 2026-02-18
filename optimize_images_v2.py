#!/usr/bin/env python3
"""
Скрипт для оптимизации изображений в проекте с выбором лучшего формата
"""
import os
from PIL import Image
import argparse

def optimize_image(input_path, output_path, quality=80, max_size=(1920, 1080)):
    """
    Оптимизирует одно изображение, выбирая лучший формат и качество
    
    Args:
        input_path: путь к исходному изображению
        output_path: путь для сохранения оптимизированного изображения
        quality: качество JPEG/WebP (1-100)
        max_size: максимальный размер изображения
    """
    try:
        with Image.open(input_path) as img:
            # Преобразуем в RGB если изображение в режиме RGBA или других
            if img.mode in ('RGBA', 'LA', 'P'):
                # Создаем белый фон для прозрачных изображений
                if img.mode == 'P':
                    img = img.convert('RGBA')
                
                # Проверяем, есть ли прозрачность
                has_alpha = img.mode == 'RGBA' and 'transparency' in img.info or \
                           img.mode == 'P' and 'transparency' in img.info
                
                if has_alpha:
                    # Для изображений с прозрачностью используем WebP
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1])
                    img = background
                else:
                    # Просто конвертируем в RGB
                    img = img.convert('RGB')
            else:
                img = img.convert('RGB')
            
            # Изменяем размер если изображение больше max_size
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Временные пути для сравнения
            temp_jpg = output_path.replace('.webp', '_temp.jpg').replace('.jpg', '_temp.jpg')
            temp_webp = output_path.replace('.jpg', '_temp.webp').replace('.webp', '_temp.webp')
            
            # Сохраняем в разных форматах
            img.save(temp_jpg, 'JPEG', quality=quality, optimize=True)
            img.save(temp_webp, 'WEBP', quality=quality, method=6, optimize=True)
            
            # Выбираем меньший по размеру файл
            original_size = os.path.getsize(input_path)
            jpg_size = os.path.getsize(temp_jpg)
            webp_size = os.path.getsize(temp_webp)
            
            # Выбираем лучший формат
            if jpg_size <= webp_size and jpg_size < original_size:
                # JPEG лучше и он меньше оригинала
                os.rename(temp_jpg, output_path)
                final_size = jpg_size
                format_used = "JPEG"
            elif webp_size < original_size:
                # WebP лучше и он меньше оригинала
                os.rename(temp_webp, output_path)
                final_size = webp_size
                format_used = "WebP"
            else:
                # Ни один формат не дал улучшения - используем лучший из двух
                if jpg_size <= webp_size:
                    os.rename(temp_jpg, output_path)
                    final_size = jpg_size
                    format_used = "JPEG"
                else:
                    os.rename(temp_webp, output_path)
                    final_size = webp_size
                    format_used = "WebP"
            
            # Удаляем временный файл если он остался
            if os.path.exists(temp_jpg) and temp_jpg != output_path:
                os.remove(temp_jpg)
            if os.path.exists(temp_webp) and temp_webp != output_path:
                os.remove(temp_webp)
            
            reduction_percent = (1 - final_size/original_size)*100
            
            print(f"Оптимизировано: {input_path}")
            print(f"  Формат: {format_used}, размер: {original_size:,} байт -> {final_size:,} байт ({reduction_percent:.1f}% сжатия)")
            
    except Exception as e:
        print(f"Ошибка при оптимизации {input_path}: {e}")

def main():
    parser = argparse.ArgumentParser(description='Оптимизация изображений в проекте')
    parser.add_argument('--quality', type=int, default=80, help='Качество JPEG/WebP (по умолчанию 80)')
    parser.add_argument('--max-width', type=int, default=800, help='Максимальная ширина (по умолчанию 800)')
    parser.add_argument('--max-height', type=int, default=600, help='Максимальная высота (по умолчанию 600)')
    
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
        
        # Заменяем расширение на .jpg или .webp в зависимости от того, что лучше
        base_path = os.path.splitext(output_path)[0]
        output_path = base_path + '.webp'  # Используем WebP как основной формат
        
        optimize_image(input_path, output_path, args.quality, (args.max_width, args.max_height))

if __name__ == "__main__":
    main()