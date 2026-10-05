#!/usr/bin/env node
/**
 * Проверяет файлы коллекции по манифесту CHECKSUMS.sha256.
 * Работает в любой ОС, где есть Node.js (в отличие от команды sha256sum).
 *
 * Запуск:
 *     node tools/verify-checksums.js
 *
 * Код возврата 0 — всё совпало, 1 — есть расхождения (файл изменён,
 * повреждён или пропал).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST = path.join(process.cwd(), 'CHECKSUMS.sha256');

if (!fs.existsSync(MANIFEST)) {
    console.error('Нет файла CHECKSUMS.sha256. Создайте его: node tools/make-checksums.js');
    process.exit(1);
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const lines = fs.readFileSync(MANIFEST, 'utf8')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean);

let ok = 0;
const missing = [];
const changed = [];

for (const line of lines) {
    const sep = line.indexOf('  ');
    if (sep === -1) continue;
    const expected = line.slice(0, sep);
    const rel = line.slice(sep + 2);

    if (!fs.existsSync(rel)) {
        missing.push(rel);
        continue;
    }
    const actual = sha256(rel);
    if (actual === expected) ok++;
    else changed.push(rel);
}

console.log(`Проверено файлов: ${lines.length}`);
console.log(`  ✅ совпадают: ${ok}`);
if (missing.length) {
    console.log(`  ❌ отсутствуют: ${missing.length}`);
    missing.slice(0, 20).forEach((f) => console.log(`      - ${f}`));
}
if (changed.length) {
    console.log(`  ⚠️  изменены: ${changed.length}`);
    changed.slice(0, 20).forEach((f) => console.log(`      - ${f}`));
}

if (missing.length || changed.length) {
    console.log('\nЕсли вы не меняли эти файлы намеренно — восстановите их из резервной копии.');
    process.exit(1);
}
console.log('\n✅ Коллекция соответствует манифесту — изменения не обнаружены.');
