from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Literal

import httpx
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from kokoro import KPipeline
except Exception:  # pragma: no cover - health endpoint reports the missing runtime
    KPipeline = None

APP_NAME = "faceless-avatar-worker"
MUSETALK_DIR = Path(os.getenv("MUSETALK_DIR", "/opt/musetalk"))
SHARED_DIR = Path(os.getenv("SHARED_DIR", "/shared"))
RENDER_DIR = SHARED_DIR / "renders"
WORK_DIR = SHARED_DIR / "avatar-work"
MAX_SOURCE_BYTES = 25 * 1024 * 1024
MUSETALK_UNET = MUSETALK_DIR / "models/musetalkV15/unet.pth"
MUSETALK_CONFIG = MUSETALK_DIR / "models/musetalkV15/musetalk.json"
WHISPER_DIR = MUSETALK_DIR / "models/whisper"

app = FastAPI(title="Faceless AI Presenter Worker", version="1.0.0")
_tts_pipelines: dict[str, object] = {}
_generation_lock = asyncio.Lock()


class PresenterRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=128)
    image_ref: str = Field(min_length=1, max_length=4096)
    script: str = Field(min_length=1, max_length=12000)
    voice: str = Field(default="af_heart", min_length=1, max_length=128)
    consent: Literal[True]
    aspect: Literal["9:16", "1:1", "16:9"] = "9:16"
    bbox_shift: int = Field(default=0, ge=-20, le=20)


class PresenterResponse(BaseModel):
    ok: bool
    job_id: str
    output_file: str
    relative_asset: str
    engine: str = "musetalk-v1.5"
    tts_engine: str = "kokoro"


def _check_binary(name: str) -> bool:
    return shutil.which(name) is not None


def runtime_state() -> dict[str, object]:
    return {
        "cuda_visible": bool(os.getenv("NVIDIA_VISIBLE_DEVICES")) or Path("/dev/nvidia0").exists(),
        "ffmpeg": _check_binary("ffmpeg"),
        "musetalk_checkout": (MUSETALK_DIR / "scripts/inference.py").exists(),
        "musetalk_weights": MUSETALK_UNET.exists() and MUSETALK_CONFIG.exists() and WHISPER_DIR.exists(),
        "kokoro": KPipeline is not None,
        "shared_storage": SHARED_DIR.exists(),
    }


@app.get("/healthz")
def healthz():
    state = runtime_state()
    ready = all(bool(state[key]) for key in ("ffmpeg", "musetalk_checkout", "musetalk_weights", "kokoro", "shared_storage"))
    return {"ok": ready, "service": APP_NAME, "dependencies": state}


def _safe_job_id(value: str) -> str:
    clean = "".join(ch for ch in value if ch.isalnum() or ch in "-_" )[:128]
    if not clean:
        raise HTTPException(status_code=400, detail="Invalid job id")
    return clean


async def _materialize_image(image_ref: str, destination: Path) -> Path:
    if image_ref.startswith("http://") or image_ref.startswith("https://"):
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            async with client.stream("GET", image_ref) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "")
                if not content_type.startswith("image/"):
                    raise HTTPException(status_code=400, detail=f"Presenter URL is not an image ({content_type or 'unknown type'})")
                written = 0
                with destination.open("wb") as handle:
                    async for chunk in response.aiter_bytes():
                        written += len(chunk)
                        if written > MAX_SOURCE_BYTES:
                            raise HTTPException(status_code=413, detail="Presenter image exceeds 25MB")
                        handle.write(chunk)
        return destination

    candidate = Path(image_ref)
    allowed_roots = (SHARED_DIR.resolve(), Path("/opt/assets").resolve())
    try:
        resolved = candidate.resolve(strict=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Presenter image does not exist") from exc
    if not any(root == resolved or root in resolved.parents for root in allowed_roots):
        raise HTTPException(status_code=400, detail="Local presenter image must be in shared storage")
    if resolved.stat().st_size > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail="Presenter image exceeds 25MB")
    shutil.copy2(resolved, destination)
    return destination


def _language_code(voice: str) -> str:
    if voice.startswith("bf_") or voice.startswith("bm_"):
        return "b"
    return "a"


def _tts_pipeline(lang_code: str):
    if KPipeline is None:
        raise RuntimeError("Kokoro is not installed in the avatar worker")
    if lang_code not in _tts_pipelines:
        _tts_pipelines[lang_code] = KPipeline(lang_code=lang_code)
    return _tts_pipelines[lang_code]


def _synthesize(script: str, voice: str, output: Path) -> None:
    pipeline = _tts_pipeline(_language_code(voice))
    parts: list[np.ndarray] = []
    for _graphemes, _phonemes, audio in pipeline(script, voice=voice):
        parts.append(np.asarray(audio, dtype=np.float32))
    if not parts:
        raise RuntimeError("Kokoro returned no audio")
    merged = np.concatenate(parts)
    sf.write(output, merged, 24000)


def _write_musetalk_config(image: Path, audio: Path, output_name: str, config_path: Path) -> None:
    # MuseTalk's public inference config is a map of tasks with video_path/audio_path/result_name.
    payload = (
        "task_0:\n"
        f"  video_path: {json.dumps(str(image))}\n"
        f"  audio_path: {json.dumps(str(audio))}\n"
        f"  result_name: {json.dumps(output_name)}\n"
    )
    config_path.write_text(payload, encoding="utf-8")


def _run_musetalk(config_path: Path, result_dir: Path, output_name: str, bbox_shift: int) -> Path:
    result_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "python", "-m", "scripts.inference",
        "--inference_config", str(config_path),
        "--result_dir", str(result_dir),
        "--unet_model_path", str(MUSETALK_UNET),
        "--unet_config", str(MUSETALK_CONFIG),
        "--whisper_dir", str(WHISPER_DIR),
        "--version", "v15",
        "--fps", "25",
        "--bbox_shift", str(bbox_shift),
        "--use_float16",
        "--ffmpeg_path", str(Path(shutil.which("ffmpeg") or "/usr/bin/ffmpeg").parent),
    ]
    completed = subprocess.run(
        command,
        cwd=MUSETALK_DIR,
        text=True,
        capture_output=True,
        timeout=60 * 30,
        check=False,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    expected = result_dir / "v15" / output_name
    if completed.returncode != 0 or not expected.exists():
        tail = "\n".join((completed.stdout + "\n" + completed.stderr).splitlines()[-80:])
        raise RuntimeError(f"MuseTalk inference failed (code {completed.returncode}).\n{tail}")
    return expected


def _fit_aspect(source: Path, destination: Path, aspect: str) -> None:
    sizes = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}
    width, height = sizes[aspect]
    filter_graph = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black"
    )
    subprocess.run([
        "ffmpeg", "-y", "-i", str(source), "-vf", filter_graph,
        "-c:v", "libx264", "-crf", "18", "-preset", "fast",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(destination),
    ], check=True, capture_output=True, timeout=60 * 10)


@app.post("/v1/presenter", response_model=PresenterResponse)
async def presenter(request: PresenterRequest):
    state = runtime_state()
    missing = [key for key in ("ffmpeg", "musetalk_checkout", "musetalk_weights", "kokoro", "shared_storage") if not state[key]]
    if missing:
        raise HTTPException(status_code=503, detail={"message": "Avatar engine is not ready", "missing": missing})

    job_id = _safe_job_id(request.job_id)
    job_dir = WORK_DIR / job_id
    final_output = RENDER_DIR / f"{job_id}.mp4"
    job_dir.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    image = job_dir / "presenter.png"
    audio = job_dir / "speech.wav"
    config = job_dir / "musetalk.yaml"
    raw_output_name = f"{job_id}-raw.mp4"
    result_dir = job_dir / "results"

    await _materialize_image(request.image_ref, image)

    # Model inference is intentionally serialized per worker. Scale horizontally by running one worker per GPU.
    async with _generation_lock:
        await asyncio.to_thread(_synthesize, request.script, request.voice, audio)
        _write_musetalk_config(image, audio, raw_output_name, config)
        raw = await asyncio.to_thread(_run_musetalk, config, result_dir, raw_output_name, request.bbox_shift)
        await asyncio.to_thread(_fit_aspect, raw, final_output, request.aspect)

    if not final_output.exists() or final_output.stat().st_size < 10_000:
        raise HTTPException(status_code=500, detail="AI presenter renderer produced no usable output")

    return PresenterResponse(
        ok=True,
        job_id=job_id,
        output_file=str(final_output),
        relative_asset=f"/api/assets/{job_id}.mp4",
    )
