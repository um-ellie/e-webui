"""Unit tests for OllamaClient."""

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import PromptRequest
from app.services.ollama_client import OllamaClient


@pytest.mark.asyncio
async def test_get_models_success(mock_tags):
    """Verifies get_models correctly parses models and picks default."""
    client = OllamaClient(base_url="http://test-ollama:11434")

    mock_response = httpx.Response(
        status_code=200,
        json=mock_tags,
        request=httpx.Request("GET", "http://test-ollama:11434/api/tags"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        result = await client.get_models()

        assert len(result.models) == 2
        assert result.models[0].name == "qwen3.5:4b"
        assert result.models[0].parameter_size == "4.2B"
        assert result.default_model == "qwen3.5:4b"


@pytest.mark.asyncio
async def test_check_health(mock_tags):
    """Verifies health check returns true on HTTP 200."""
    client = OllamaClient(base_url="http://test-ollama:11434")

    mock_response = httpx.Response(
        status_code=200,
        json=mock_tags,
        request=httpx.Request("GET", "http://test-ollama:11434/api/tags"),
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        connected = await client.check_health()
        assert connected is True


@pytest.mark.asyncio
async def test_stream_generate(mock_generate_chunks):
    """Verifies stream_generate correctly translates Ollama NDJSON to SSE chunks."""
    client = OllamaClient(base_url="http://test-ollama:11434")

    req = PromptRequest(model="qwen3.5:4b", prompt="Why is the sky blue?")

    async def mock_aiter_lines():
        for chunk in mock_generate_chunks:
            yield chunk.decode("utf-8")

    mock_stream_response = AsyncMock()
    mock_stream_response.status_code = 200
    mock_stream_response.aiter_lines = mock_aiter_lines

    class MockStreamContext:
        async def __aenter__(self):
            return mock_stream_response
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_client = MagicMock()
    mock_client.stream.return_value = MockStreamContext()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        collected_events = []
        async for sse_event in client.stream_generate(req):
            collected_events.append(sse_event)

        assert len(collected_events) == 5
        assert "The" in collected_events[0]
        assert '"done":false' in collected_events[0]
        assert '"done":true' in collected_events[-1]
