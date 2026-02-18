#!/usr/bin/env python3
"""
Скрипт для минификации и объединения JS файлов
"""
import os
import re
import argparse

def minify_js(js_content):
    """Минифицирует JS контент"""
    # Удаляем комментарии однострочные
    js_content = re.sub(r'//.*$', '', js_content, flags=re.MULTILINE)
    # Удаляем многострочные комментарии
    js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
    # Удаляем лишние пробелы и переносы строк, но сохраняем точки с запятой и структуру
    lines = js_content.split('\n')
    minified_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            minified_lines.append(stripped)
    
    minified_js = ' '.join(minified_lines)
    # Удаляем лишние пробелы вокруг операторов
    minified_js = re.sub(r'\s*([{}:=;,+\-*/<>()[\]])\s*', r'\1', minified_js)
    # Восстанавливаем необходимые пробелы после ключевых слов
    keywords = ['var', 'let', 'const', 'function', 'if', 'else', 'for', 'while', 'do', 'return', 'try', 'catch', 'finally', 'switch', 'case', 'default', 'break', 'continue']
    for keyword in keywords:
        pattern = r'\b' + keyword + r'\b'
        minified_js = re.sub(pattern, keyword, minified_js)
    
    return minified_js

def combine_and_minify_js_files(input_files, output_file):
    """Объединяет и минифицирует JS файлы"""
    combined_js = ""
    
    for js_file in input_files:
        if os.path.exists(js_file):
            with open(js_file, 'r', encoding='utf-8') as f:
                js_content = f.read()
                # Добавляем разделитель между файлами
                combined_js += f"\n/* FILE: {os.path.basename(js_file)} */\n" + js_content + "\n"
                print(f"Добавлен файл: {js_file}")
        else:
            print(f"Файл не найден: {js_file}")
    
    # Минификация объединенного JS
    minified_js = minify_js(combined_js)
    
    # Запись в выходной файл
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(minified_js)
    
    original_size = len(combined_js.encode('utf-8'))
    minified_size = len(minified_js.encode('utf-8'))
    
    print(f"\nОбъединено и минифицировано JS файлов")
    print(f"Размер до: {original_size:,} байт")
    print(f"Размер после: {minified_size:,} байт")
    print(f"Сжатие: {((original_size - minified_size) / original_size * 100):.1f}%")
    print(f"Выходной файл: {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Минификация и объединение JS файлов')
    parser.add_argument('--output', default='/workspace/script.min.js', help='Выходной файл')
    parser.add_argument('input_files', nargs='+', help='JS файлы для объединения')
    
    args = parser.parse_args()
    
    combine_and_minify_js_files(args.input_files, args.output)

if __name__ == "__main__":
    main()