"""FastAPI application entrypoint and route handlers."""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import APP_HOST, APP_PORT, OLLAMA_HOST
from app.models import HealthResponse, ModelListResponse, PromptRequest, TTSRequest
from app.services.ollama_client import OllamaClient
from app.services.tts_service import tts_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("e-webui")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

ollama_client = OllamaClient(base_url=OLLAMA_HOST)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application lifecycle including persistent client connection pools."""
    await ollama_client.start()
    try:
        yield
    finally:
        await ollama_client.close()


app = FastAPI(
    title="e-webui",
    description="Lightweight and secure web interface for Ollama on Incus",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware (dynamically bound to configured host port)
cors_origins = [
    f"http://127.0.0.1:{APP_PORT}",
    f"http://localhost:{APP_PORT}",
]
if APP_PORT != 8080:
    cors_origins.extend(["http://127.0.0.1:8080", "http://localhost:8080"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    """Injects standard defensive HTTP security headers into all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "media-src 'self' blob:; "
        "connect-src 'self';"
    )
    return response

# Mount static directory
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=FileResponse)
async def serve_index():
    """Serves the single-page chat interface."""
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UI template not found",
        )
    return FileResponse(index_file)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Liveness check and upstream Ollama connection status."""
    connected = await ollama_client.check_health()
    return HealthResponse(
        status="ok" if connected else "degraded",
        ollama_connected=connected,
        ollama_url=OLLAMA_HOST,
    )


@app.get("/api/models", response_model=ModelListResponse)
async def list_models():
    """Returns available models configured in Ollama."""
    try:
        return await ollama_client.get_models()
    except Exception as exc:
        logger.error(f"Failed to fetch models: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is unreachable or returned an error.",
        )


@app.post("/api/generate")
async def generate_response(request: PromptRequest):
    """Streams token generation from Ollama using Server-Sent Events."""
    req_id = str(uuid.uuid4())[:8]
    start_time = time.monotonic()
    logger.info(
        f"[{req_id}] Generation started: model='{request.model}', "
        f"prompt_len={len(request.prompt)}, history_turns={len(request.history)}"
    )

    async def logged_stream():
        first_token_time = None
        error_category = None
        try:
            async for chunk in ollama_client.stream_generate(request):
                if first_token_time is None:
                    first_token_time = time.monotonic()
                    ttft = (first_token_time - start_time) * 1000
                    logger.info(f"[{req_id}] First token emitted after {ttft:.1f}ms")
                if '"error":' in chunk and '"error":null' not in chunk:
                    error_category = "OllamaError"
                yield chunk
        except Exception as exc:
            error_category = type(exc).__name__
            logger.error(f"[{req_id}] Stream failed with category={error_category}: {exc}")
            raise
        finally:
            total_duration = (time.monotonic() - start_time) * 1000
            logger.info(
                f"[{req_id}] Generation ended: total_duration={total_duration:.1f}ms, "
                f"error_category={error_category or 'none'}"
            )

    return StreamingResponse(
        logged_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Request-ID": req_id,
        },
    )


@app.post("/api/tts/synthesize")
async def synthesize_speech(request: TTSRequest):
    """Synthesizes text into 24kHz WAV audio via Kokoro on CPU."""
    if not tts_service.available:
        logger.warning(f"TTS synthesis requested but service unavailable: {tts_service.error_reason}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=tts_service.error_reason or "TTS service is currently unavailable.",
        )

    try:
        start_time = time.monotonic()
        wav_bytes = await tts_service.synthesize(request.text)
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(
            f"TTS synthesized successfully for message_id='{request.message_id}' "
            f"in {duration_ms}ms ({len(wav_bytes)} bytes)"
        )
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "Content-Type": "audio/wav",
                "Content-Disposition": 'inline; filename="speech.wav"',
                "Cache-Control": "private, max-age=86400",
                "X-Synthesis-Duration-Ms": str(duration_ms),
            },
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(run_err),
        )
    except Exception as exc:
        logger.error(f"TTS synthesis failed for message_id='{request.message_id}': {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to synthesize audio.",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=APP_HOST, port=APP_PORT, reload=False)
