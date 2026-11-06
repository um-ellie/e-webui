"""Asynchronous HTTP client for communicating with Ollama API."""

import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx

from app.config import OLLAMA_HOST
from app.models import ModelItem, ModelListResponse, PromptRequest, StreamChunk

logger = logging.getLogger(__name__)


class OllamaClient:
    """Handles communication with the local Ollama instance."""

    def __init__(self, base_url: str = OLLAMA_HOST, timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def check_health(self) -> bool:
        """Checks if Ollama service is reachable and responding."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception as exc:
            logger.warning(f"Ollama health check failed: {exc}")
            return False

    async def get_models(self) -> ModelListResponse:
        """Retrieves and normalizes available models from Ollama."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                res.raise_for_status()
                data = res.json()
        except Exception as exc:
            logger.error(f"Error fetching Ollama models: {exc}")
            raise

        models: List[ModelItem] = []
        raw_models = data.get("models", [])
        default_model: Optional[str] = None

        for item in raw_models:
            name = item.get("name") or item.get("model", "")
            if not name:
                continue

            details = item.get("details", {})
            models.append(
                ModelItem(
                    name=name,
                    size=item.get("size", 0),
                    parameter_size=details.get("parameter_size"),
                    quantization=details.get("quantization_level"),
                    modified_at=item.get("modified_at"),
                )
            )

        if models:
            # Prefer a text model (like qwen3.5:4b) over embeddings as default
            for m in models:
                if "embed" not in m.name.lower():
                    default_model = m.name
                    break
            if not default_model:
                default_model = models[0].name

        return ModelListResponse(models=models, default_model=default_model)

    async def stream_generate(
        self, req: PromptRequest
    ) -> AsyncGenerator[str, None]:
        """Streams generated tokens from Ollama /api/generate via SSE format."""
        payload: Dict[str, Any] = {
            "model": req.model,
            "prompt": req.prompt,
            "stream": True,
            "options": {
                "temperature": req.temperature,
            },
        }
        if not req.thinking:
            payload["think"] = False
            payload["options"]["think"] = False
        if req.system:
            payload["system"] = req.system

        url = f"{self.base_url}/api/generate"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_text = await response.aread()
                        err_msg = f"Ollama returned HTTP {response.status_code}: {err_text.decode('utf-8', errors='ignore')}"
                        logger.error(err_msg)
                        chunk = StreamChunk(done=True, error=err_msg)
                        yield f"data: {chunk.model_dump_json()}\n\n"
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            parsed = json.loads(line)
                            token = parsed.get("response", "")
                            thinking = parsed.get("thinking", None)
                            done = bool(parsed.get("done", False))

                            if not req.thinking:
                                thinking = None
                                if not token and not done:
                                    continue

                            chunk = StreamChunk(
                                token=token,
                                thinking=thinking,
                                done=done,
                                eval_count=parsed.get("eval_count"),
                                total_duration=parsed.get("total_duration"),
                            )
                            yield f"data: {chunk.model_dump_json()}\n\n"
                            if done:
                                break
                        except json.JSONDecodeError:
                            continue

        except httpx.ConnectError:
            err_msg = "Cannot connect to Ollama. Verify the container and proxy are running."
            logger.error(err_msg)
            chunk = StreamChunk(done=True, error=err_msg)
            yield f"data: {chunk.model_dump_json()}\n\n"
        except Exception as exc:
            err_msg = f"Unexpected error while streaming from Ollama: {str(exc)}"
            logger.error(err_msg)
            chunk = StreamChunk(done=True, error=err_msg)
            yield f"data: {chunk.model_dump_json()}\n\n"
