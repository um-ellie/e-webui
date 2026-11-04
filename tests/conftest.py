"""Pytest fixtures for unit and integration testing."""

import pytest
from typing import AsyncGenerator, Dict, Any
from unittest.mock import AsyncMock, patch

MOCK_TAGS_RESPONSE = {
    "models": [
        {
            "name": "qwen3.5:4b",
            "model": "qwen3.5:4b",
            "modified_at": "2026-10-10T00:52:06Z",
            "size": 3324173934,
            "digest": "d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04",
            "details": {
                "parent_model": "model.gguf",
                "format": "gguf",
                "family": "qwen35",
                "parameter_size": "4.2B",
                "quantization_level": "Q4_K_M",
            },
        },
        {
            "name": "nomic-embed-text:latest",
            "model": "nomic-embed-text:latest",
            "modified_at": "2026-10-09T23:31:11Z",
            "size": 274302450,
            "details": {
                "parameter_size": "137M",
                "quantization_level": "F16",
            },
        },
    ]
}

MOCK_GENERATE_CHUNKS = [
    b'{"model":"qwen3.5:4b","response":"The","done":false}\n',
    b'{"model":"qwen3.5:4b","response":" sky","done":false}\n',
    b'{"model":"qwen3.5:4b","response":" is","done":false}\n',
    b'{"model":"qwen3.5:4b","response":" blue.","done":false}\n',
    b'{"model":"qwen3.5:4b","response":"","done":true,"eval_count":4}\n',
]


@pytest.fixture
def mock_tags():
    """Returns sample Ollama tags payload."""
    return MOCK_TAGS_RESPONSE


@pytest.fixture
def mock_generate_chunks():
    """Returns raw streaming bytes matching Ollama /api/generate format."""
    return MOCK_GENERATE_CHUNKS
