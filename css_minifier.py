#!/usr/bin/env python3
"""
Скрипт для минификации и объединения CSS файлов
"""
import os
import re
import argparse

def minify_css(css_content):
    """Минифицирует CSS контент"""
    # Удаляем комментарии
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
    # Удаляем лишние пробелы и переносы строк
    css_content = re.sub(r'\s+', ' ', css_content)
    # Удаляем пробелы вокруг фигурных скобок, двоеточий и точек с запятой
    css_content = re.sub(r'\s*{\s*', '{', css_content)
    css_content = re.sub(r'\s*;\s*', ';', css_content)
    css_content = re.sub(r'\s*:\s*', ':', css_content)
    css_content = re.sub(r'\s*,\s*', ',', css_content)
    css_content = re.sub(r'\s*\)\s*', ')', css_content)
    css_content = re.sub(r'\s*\(\s*', '(', css_content)
    # Удаляем лишние пробелы в начале и конце
    css_content = css_content.strip()
    return css_content

def combine_and_minify_css_files(input_files, output_file):
    """Объединяет и минифицирует CSS файлы"""
    combined_css = ""
    
    for css_file in input_files:
        if os.path.exists(css_file):
            with open(css_file, 'r', encoding='utf-8') as f:
                css_content = f.read()
                combined_css += css_content + "\n"
                print(f"Добавлен файл: {css_file}")
        else:
            print(f"Файл не найден: {css_file}")
    
    # Минификация объединенного CSS
    minified_css = minify_css(combined_css)
    
    # Запись в выходной файл
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(minified_css)
    
    original_size = len(combined_css.encode('utf-8'))
    minified_size = len(minified_css.encode('utf-8'))
    
    print(f"\nОбъединено и минифицировано CSS файлов")
    print(f"Размер до: {original_size:,} байт")
    print(f"Размер после: {minified_size:,} байт")
    print(f"Сжатие: {((original_size - minified_size) / original_size * 100):.1f}%")
    print(f"Выходной файл: {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Минификация и объединение CSS файлов')
    parser.add_argument('--output', default='/workspace/style.min.css', help='Выходной файл')
    parser.add_argument('input_files', nargs='+', help='CSS файлы для объединения')
    
    args = parser.parse_args()
    
    combine_and_minify_css_files(args.input_files, args.output)

if __name__ == "__main__":
    main()