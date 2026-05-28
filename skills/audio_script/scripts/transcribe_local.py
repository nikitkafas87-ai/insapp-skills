#!/usr/bin/env python3
"""Transcribe local audio files for free with faster-whisper."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path


AUDIO_EXTENSIONS = {".ogg", ".opus", ".mp3", ".m4a", ".wav", ".webm", ".mp4", ".mpeg", ".mpga", ".flac"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe a local audio file or folder with faster-whisper.")
    parser.add_argument("path", help="Audio file or folder with audio files.")
    parser.add_argument("--out-dir", help="Directory for TRANSCRIPT_RAW.md. Defaults to stdout for one file, input folder for folders.")
    parser.add_argument("--language", help="Language hint such as ru or en. Omit for autodetect.")
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"), help="Whisper model: tiny, base, small, medium, large-v3.")
    parser.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "cpu"), help="cpu or cuda.")
    parser.add_argument("--compute-type", default=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"), help="int8, float16, float32, etc.")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--vad-filter", action="store_true", help="Enable VAD filtering for silence.")
    return parser.parse_args()


def find_audio_files(path: Path) -> list[Path]:
    if path.is_file():
        if path.suffix.lower() not in AUDIO_EXTENSIONS:
            raise SystemExit(f"Unsupported audio extension: {path.suffix}")
        return [path]
    if not path.is_dir():
        raise SystemExit(f"Path not found: {path}")
    files = [p for p in sorted(path.rglob("*")) if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS]
    if not files:
        raise SystemExit(f"No supported audio files found in: {path}")
    return files


def fmt_time(seconds: float) -> str:
    total = int(seconds)
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def transcribe_file(model, audio_path: Path, args: argparse.Namespace) -> tuple[str, list[str]]:
    segments, info = model.transcribe(
        str(audio_path),
        language=args.language,
        beam_size=args.beam_size,
        vad_filter=args.vad_filter,
        condition_on_previous_text=False,
    )
    lines = [
        f"## {audio_path.name}",
        "",
        f"- Language: {info.language} ({info.language_probability:.2f})",
        f"- Duration: {fmt_time(info.duration)}",
        "",
    ]
    plain_parts: list[str] = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        lines.append(f"[{fmt_time(segment.start)} - {fmt_time(segment.end)}] {text}")
        plain_parts.append(text)
    lines.append("")
    return "\n".join(plain_parts).strip(), lines


def main() -> int:
    args = parse_args()
    if not shutil.which("ffmpeg"):
        print("Warning: ffmpeg was not found in PATH. Some audio formats may fail.", file=sys.stderr)

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SystemExit("Missing faster-whisper. Run with: uv run --with faster-whisper python transcribe_local.py ...") from exc

    input_path = Path(args.path).expanduser().resolve()
    files = find_audio_files(input_path)
    print(f"Loading faster-whisper model '{args.model}' on {args.device} ({args.compute_type})...", file=sys.stderr)
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)

    all_lines = ["# TRANSCRIPT_RAW", ""]
    single_plain = ""
    for index, audio_file in enumerate(files, start=1):
        print(f"[{index}/{len(files)}] Transcribing {audio_file}", file=sys.stderr)
        plain, lines = transcribe_file(model, audio_file, args)
        if len(files) == 1:
            single_plain = plain
        all_lines.extend(lines)

    if args.out_dir:
        out_dir = Path(args.out_dir).expanduser().resolve()
    elif input_path.is_dir():
        out_dir = input_path
    else:
        out_dir = None

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "TRANSCRIPT_RAW.md"
        out_path.write_text("\n".join(all_lines).rstrip() + "\n", encoding="utf-8")
        print(str(out_path))
    else:
        print(single_plain)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
