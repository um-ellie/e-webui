"""Pydantic data models for the Ollama Web UI."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PromptRequest(BaseModel):
    """Incoming request payload for model inference."""

    model: str = Field(..., description="Target Ollama model name, e.g. qwen3.5:4b")
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=100000,
        description="User prompt text, cannot be empty",
    )
    system: Optional[str] = Field(
        default=None, description="Optional system instruction"
    )
    stream: bool = Field(
        default=True, description="Whether to stream response tokens"
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature between 0.0 and 2.0",
    )


class StreamChunk(BaseModel):
    """Incremental response chunk emitted via SSE."""

    token: str = Field(default="", description="Generated token fragment")
    thinking: Optional[str] = Field(
        default=None, description="Thinking/reasoning token fragment"
    )
    done: bool = Field(default=False, description="Whether generation has finished")
    eval_count: Optional[int] = Field(
        default=None, description="Total tokens evaluated"
    )
    total_duration: Optional[int] = Field(
        default=None, description="Total duration in nanoseconds"
    )
    error: Optional[str] = Field(
        default=None, description="Error message if generation failed"
    )


class ModelItem(BaseModel):
    """Model information returned to the frontend."""

    name: str = Field(..., description="Model identifier used in API requests")
    size: int = Field(default=0, description="Model file size in bytes")
    parameter_size: Optional[str] = Field(
        default=None, description="Human-readable parameter size e.g. 4.2B"
    )
    quantization: Optional[str] = Field(
        default=None, description="Quantization level e.g. Q4_K_M"
    )
    modified_at: Optional[str] = Field(
        default=None, description="ISO timestamp of last update"
    )


class ModelListResponse(BaseModel):
    """Response containing list of available Ollama models."""

    models: List[ModelItem] = Field(default_factory=list)
    default_model: Optional[str] = None


class HealthResponse(BaseModel):
    """Liveness probe response."""

    status: str = "ok"
    ollama_connected: bool = False
    ollama_url: str
