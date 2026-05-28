# Audio Script - расшифровка аудио без API

Windows-адаптация скилла `audio_script`: расшифровывает аудио локально через `faster-whisper`, без OpenAI API-ключа и без API-оплаты. Может обрабатывать голосовые `.ogg` и папки с записями звонков.

## Команда

```text
/audio_script [файл или папка]
/audio_script C:\Users\nikit\Downloads\audio.ogg
/audio_script C:\Users\nikit\Downloads\calls
```

## Что делает

1. Находит аудиофайлы в файле или папке.
2. Запускает локальный `faster-whisper` через `uv`.
3. Расшифровывает `.ogg`, `.opus`, `.mp3`, `.m4a`, `.wav`, `.webm`, `.mp4`, `.flac`.
4. Для папки создает `TRANSCRIPT_RAW.md`.
5. При необходимости на основе расшифровок помогает создать `CALLBOT_SCRIPT.md`.

## Пример запуска

```powershell
uv run --with faster-whisper python C:\Users\nikit\.codex\skills\audio_script\scripts\transcribe_local.py "C:\Users\nikit\Downloads\audio.ogg" --language ru
```

Для папки:

```powershell
uv run --with faster-whisper python C:\Users\nikit\.codex\skills\audio_script\scripts\transcribe_local.py "C:\Users\nikit\Downloads\calls" --language ru --out-dir "C:\Users\nikit\Downloads\calls"
```

## Пример вывода

```text
call-folder/
├── call_001.mp3
├── call_002.ogg
└── TRANSCRIPT_RAW.md
```

## Требования

- `uv`
- `ffmpeg`
- интернет при первом скачивании модели Whisper

OpenAI API-ключ не нужен.
