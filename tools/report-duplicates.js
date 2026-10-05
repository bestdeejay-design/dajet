#!/usr/bin/env node
/**
 * Ищет побайтово одинаковые аудиофайлы в коллекции.
 *
 * В коллекции есть треки, которые лежат сразу в нескольких альбомах
 * (например, один и тот же микс в «Legendary» и «Whisper»). Это может быть
 * задумано, а может быть следствием случайного копирования — поэтому
 * инструмент только показывает находки и ничего не удаляет.
 *
 * Запуск:
 *     node tools/report-duplicates.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COLLECTION_DIR = path.join(process.cwd(), 'albums');

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

function sha256(file) {
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(1 << 20);
    try {
        let bytes;
        while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
            hash.update(buf.subarray(0, bytes));
        }
    } finally {
        fs.closeSync(fd);
    }
    return hash.digest('hex');
}

if (!fs.existsSync(COLLECTION_DIR)) {
    console.error('Папка albums не найдена');
    process.exit(1);
}

const audio = walk(COLLECTION_DIR)
    .filter((f) => /\.(m4a|mp3|wav|ogg|opus|flac)$/i.test(f))
    .map((f) => path.relative(process.cwd(), f).split(path.sep).join('/'))
    .sort();

const byHash = new Map();
for (const file of audio) {
    const hash = sha256(file);
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(file);
}

const groups = [...byHash.values()].filter((g) => g.length > 1);
let wasted = 0;

console.log(`Аудиофайлов: ${audio.length}`);
console.log(`Групп одинаковых файлов: ${groups.length}\n`);

for (const group of groups) {
    const size = fs.statSync(group[0]).size;
    wasted += size * (group.length - 1);
    console.log(`${group.length} копии по ${(size / 1048576).toFixed(1)} MB:`);
    group.forEach((f) => console.log(`   ${f}`));
    console.log('');
}

if (groups.length) {
    console.log(`Лишний объём, если оставить по одному файлу: ${(wasted / 1048576).toFixed(1)} MB`);
    console.log('Решение об удалении — за вами: копия может быть намеренной.');
} else {
    console.log('Одинаковых файлов нет.');
}
