"""Integration tests for FastAPI endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.main import app
from app.models import ModelItem, ModelListResponse


@pytest.mark.asyncio
async def test_health_endpoint():
    """Verifies /api/health endpoint structure."""
    with patch("app.main.ollama_client.check_health", new_callable=AsyncMock) as mock_health:
        mock_health.return_value = True

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/health")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "ok"
            assert data["ollama_connected"] is True


@pytest.mark.asyncio
async def test_models_endpoint():
    """Verifies /api/models returns formatted model list."""
    mock_models_resp = ModelListResponse(
        models=[
            ModelItem(name="qwen3.5:4b", size=3000000000, parameter_size="4.2B")
        ],
        default_model="qwen3.5:4b",
    )

    with patch("app.main.ollama_client.get_models", new_callable=AsyncMock) as mock_get_models:
        mock_get_models.return_value = mock_models_resp

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/models")
            assert res.status_code == 200
            data = res.json()
            assert len(data["models"]) == 1
            assert data["default_model"] == "qwen3.5:4b"


@pytest.mark.asyncio
async def test_generate_endpoint_streaming():
    """Verifies /api/generate streams SSE formatted events."""
    async def mock_generator(req):
        yield 'data: {"token":"Hello","done":false}\n\n'
        yield 'data: {"token":"!","done":true}\n\n'

    with patch("app.main.ollama_client.stream_generate", side_effect=mock_generator):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/generate",
                json={"model": "qwen3.5:4b", "prompt": "Hi"},
            )
            assert res.status_code == 200
            assert "text/event-stream" in res.headers["content-type"]
            text = res.text
            assert 'data: {"token":"Hello"' in text
            assert 'data: {"token":"!"' in text


@pytest.mark.asyncio
async def test_security_headers_present():
    """Verifies standard defensive security headers are returned on HTTP responses."""
    with patch("app.main.ollama_client.check_health", new_callable=AsyncMock) as mock_health:
        mock_health.return_value = True
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/health")
            assert res.headers.get("x-content-type-options") == "nosniff"
            assert res.headers.get("x-frame-options") == "DENY"
            assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
            assert "content-security-policy" in res.headers
