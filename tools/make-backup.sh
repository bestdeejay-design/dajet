#!/usr/bin/env bash
#
# Резервная копия коллекции DAJET.
#
# Коллекция — это то, что нельзя потерять, поэтому копия должна лежать
# минимум в двух местах: репозиторий на GitHub + эта выгрузка на диск
# (или внешний носитель / облако).
#
# Что делает скрипт:
#   1. Создаёт git-bundle — полную копию истории репозитория одним файлом.
#   2. Кладёт рядом манифест контрольных сумм (для проверки целостности).
#   3. По желанию — упаковывает сами файлы коллекции в tar.gz.
#
# Запуск (из любой папки):
#     bash tools/make-backup.sh [папка_назначения] [--with-media]
#
# Примеры:
#     bash tools/make-backup.sh ~/Backups/dajet
#     bash tools/make-backup.sh /media/usb/dajet --with-media

set -euo pipefail

# Запоминаем папку запуска (относительные пути считаем от неё),
# а корень репозитория определяем по расположению самого скрипта,
# чтобы команду можно было запускать откуда угодно.
CALL_DIR="$(pwd)"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DEST_ARG="${1:-./backup}"
WITH_MEDIA="no"
for arg in "$@"; do
    [ "$arg" = "--with-media" ] && WITH_MEDIA="yes"
done

# Относительный путь назначения считаем от папки запуска, а не от репозитория
if [[ "$DEST_ARG" = /* ]]; then
    DEST="$DEST_ARG"
else
    DEST="$CALL_DIR/${DEST_ARG#./}"
fi
STAMP="$(date +%Y-%m-%d)"
mkdir -p "$DEST"

echo "→ Резервная копия в $DEST (репозиторий: $REPO_ROOT)"

# 1. Полная копия репозитория (включая всю историю) одним файлом
BUNDLE="$DEST/dajet-$STAMP.bundle"
git bundle create "$BUNDLE" --all
echo "  ✓ git-bundle: $BUNDLE ($(du -h "$BUNDLE" | cut -f1))"
echo "    восстановление: git clone \"$BUNDLE\" dajet-restored"

# 2. Манифест контрольных сумм
node tools/make-checksums.js >/dev/null
cp CHECKSUMS.sha256 "$DEST/CHECKSUMS-$STAMP.sha256"
echo "  ✓ контрольные суммы: $DEST/CHECKSUMS-$STAMP.sha256"

# 3. По желанию — архив самих файлов коллекции
if [ "$WITH_MEDIA" = "yes" ]; then
    ARCHIVE="$DEST/dajet-media-$STAMP.tar.gz"
    echo "  … упаковываю коллекцию (может занять несколько минут)"
    tar -czf "$ARCHIVE" albums library.json CHECKSUMS.sha256
    echo "  ✓ архив коллекции: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
else
    echo "  ℹ архив самих файлов не создавался (флаг --with-media добавит его)"
fi

echo
echo "Готово. Храните копию отдельно от рабочего компьютера:"
echo "  • git-bundle достаточно, чтобы восстановить и сайт, и всю коллекцию;"
echo "  • проверка целостности: node tools/verify-checksums.js"
