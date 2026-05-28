---
name: audio-script
description: Use when user invokes /audio_script or asks to transcribe audio for free on Windows, convert voice notes or call recordings to text, process .ogg/.opus/.mp3/.m4a/.wav/.webm files locally, or build an AI call-bot script from call transcripts. Uses local faster-whisper and ffmpeg, not OpenAI API billing.
---

# Audio Script

## Overview

Transcribe local audio for free with local Whisper via `faster-whisper`, then optionally turn call recordings into a call-bot script. This Windows-adapted skill is installed from `geo-ai-advisory/insapp-skills` and replaces the original macOS `mlx_whisper` workflow.

Use the bundled script first for deterministic transcription. Do not use OpenAI API keys for this skill.

## Quick Start

For one audio file:

```powershell
uv run --with faster-whisper python C:\Users\nikit\.codex\skills\audio_script\scripts\transcribe_local.py "C:\path\audio.ogg" --language ru
```

For a folder with recordings:

```powershell
uv run --with faster-whisper python C:\Users\nikit\.codex\skills\audio_script\scripts\transcribe_local.py "C:\path\calls" --language ru --out-dir "C:\path\calls"
```

The script writes:

- `TRANSCRIPT_RAW.md` for a folder or when `--out-dir` is provided.
- Plain transcript to stdout for a single file without `--out-dir`.

## Requirements

- Windows PowerShell.
- `uv` available in PATH.
- `ffmpeg` available in PATH.
- Internet only for the first model download from Hugging Face.
- No OpenAI API key and no OpenAI billing.

Default model is `small` with CPU `int8`. For faster first tests use `--model base`; for better quality use `--model medium`.

## Supported Files

The script searches these audio extensions:

`.ogg`, `.opus`, `.mp3`, `.m4a`, `.wav`, `.webm`, `.mp4`, `.mpeg`, `.mpga`, `.flac`.

## Workflow

1. Check whether the user gave a file or folder path.
2. Run `scripts/transcribe_local.py` with `--language ru` unless the audio language is unknown.
3. If first run is slow, explain that the model is downloading once.
4. For simple voice notes, return the transcript directly.
5. For call folders, save `TRANSCRIPT_RAW.md`, then analyze it and create `CALLBOT_SCRIPT.md` when the user needs a call-bot script.

## Call-Bot Script

When generating `CALLBOT_SCRIPT.md`, base it only on the transcript. Do not invent product arguments or objections.

Recommended structure:

```markdown
# Скрипт AI колл-бота - [тема]

## СИСТЕМНЫЙ ПРОМПТ
[роль, цель, тон, ограничения, переменные]

## СЦЕНАРИЙ РАЗГОВОРА

### 1. Приветствие
[фраза из записей]

### 2. Ветки ответов

#### Возражение: "[реальная формулировка]"
**Ответ:** [ответ на основе записи]

## КЛЮЧЕВЫЕ ФАКТЫ
| Параметр | Значение |
|---|---|

## СТОП-ФРАЗЫ
[фразы завершения и реакция]

## ПАРАМЕТРЫ ЗВОНКА
```json
{
  "transfer_to_human_on": [],
  "max_retries": 1,
  "silence_timeout_seconds": 5
}
```
```

## Quality Rules

- Mark uncertain fragments as `[неразборчиво]` instead of guessing.
- Preserve full phone numbers, GUIDs, dates, names, prices, and URLs as recognized.
- If the transcript is incomplete, repeated, or hallucinated, retry with `--model medium` or without `--language`.
- For long recordings, keep timestamps in the transcript and report where the problem appears.
- Do not claim that speaker labels are exact unless diarization was explicitly performed. The script produces time segments, not true speaker diarization.
