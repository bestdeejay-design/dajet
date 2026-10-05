#!/usr/bin/env node
/**
 * Создаёт CHECKSUMS.sha256 — контрольные суммы sha256 всех файлов коллекции.
 *
 * Зачем: коллекция — это то, что осталось от творчества. Манифест позволяет
 * в любой момент проверить, что файлы не повреждены и не подменены — и на
 * сервере, и в локальной копии, и в резервной копии на диске.
 *
 * Запуск:
 *     node tools/make-checksums.js
 *
 * Проверка (Linux/macOS):
 *     sha256sum -c CHECKSUMS.sha256
 * Проверка (через Node, работает везде):
 *     node tools/verify-checksums.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COLLECTION_DIR = path.join(process.cwd(), 'albums');
const OUTPUT = path.join(process.cwd(), 'CHECKSUMS.sha256');

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(COLLECTION_DIR)) {
    console.error('Папка albums не найдена');
    process.exit(1);
}

const files = walk(COLLECTION_DIR)
    .map((f) => path.relative(process.cwd(), f).split(path.sep).join('/'))
    .sort((a, b) => a.localeCompare(b, 'ru'));

const lines = files.map((rel) => `${sha256(rel)}  ${rel}`);
fs.writeFileSync(OUTPUT, lines.join('\n') + '\n');

const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
console.log(`✅ CHECKSUMS.sha256: файлов ${files.length}, объём ${(bytes / 1048576).toFixed(1)} MB`);
