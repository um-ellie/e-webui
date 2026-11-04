"""FastAPI application entrypoint and route handlers."""

import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import APP_HOST, APP_PORT, OLLAMA_HOST
from app.models import HealthResponse, ModelListResponse, PromptRequest
from app.services.ollama_client import OllamaClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ollama-webui")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Secure Ollama Web UI",
    description="Lightweight and secure web interface for Ollama on Incus",
    version="1.0.0",
)

# CORS middleware (restricted to localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Mount static directory
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

ollama_client = OllamaClient(base_url=OLLAMA_HOST)


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
    logger.info(f"Generating with model='{request.model}', prompt length={len(request.prompt)}")
    return StreamingResponse(
        ollama_client.stream_generate(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=APP_HOST, port=APP_PORT, reload=False)
