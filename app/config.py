"""Configuration settings for the e-webui application."""

import os

OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT: int = int(os.getenv("APP_PORT", "8080"))
KOKORO_MODEL_DIR: str = os.getenv("KOKORO_MODEL_DIR", "/opt/e-webui/shared/models/kokoro")
