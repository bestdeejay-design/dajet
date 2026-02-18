#!/usr/bin/env python3
"""
Скрипт для обновления HTML файла с оптимизированными ссылками на CSS и JS
"""
import re

def update_html_file(html_path, new_css_path, new_js_path):
    """Обновляет HTML файл с новыми путями к CSS и JS"""
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Заменяем все CSS ссылки (кроме CDN) на одну минифицированную
    css_pattern = r'<link\s+rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*/?>\s*<!--.*?-->\s*|<link\s+rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*/?>'
    new_css_link = f'    <link rel="stylesheet" href="{new_css_path}">'
    # Заменяем все CSS строки на одну новую
    updated_html = re.sub(css_pattern, '', html_content)
    # Находим место для вставки нового CSS (после строки с "Стили")
    updated_html = re.sub(r'(<!-- Стили -->)', rf'\1\n{new_css_link}', updated_html)
    
    # Заменяем все JS скрипты (кроме CDN) на один минифицированный
    # Сначала удаляем все локальные JS скрипты (и их комментарии)
    js_pattern = r'<script\s+src="(?!https://)[^"]*\.js"[^>]*/?>\s*<!--.*?-->\s*|<script\s+src="(?!https://)[^"]*\.js"[^>]*/?>'
    updated_html = re.sub(js_pattern, '', updated_html)
    
    # Также удаляем старый модульный скрипт main.js
    module_pattern = r'<script\s+src="main\.js"\s+type="module"></script>'
    updated_html = re.sub(module_pattern, '', updated_html)
    
    # Находим место перед закрывающим тегом body и вставляем оба новых скрипта
    body_pattern = r'(</body>)'
    # Вставляем сначала наш объединенный скрипт, затем main.js
    new_script_tags = f'    <script src="{new_js_path}" defer></script>\n    <script src="main.js" defer></script>\n    </body>'
    updated_html = re.sub(body_pattern, new_script_tags, updated_html)
    
    # Сохраняем обновленный HTML
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(updated_html)
    
    print(f"HTML файл обновлен: {html_path}")
    print(f"  Новый CSS: {new_css_path}")
    print(f"  Новый JS: {new_js_path}")

if __name__ == "__main__":
    update_html_file('/workspace/index.html', 'style.min.css', 'script.min.js')