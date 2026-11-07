"""Integration tests for the /api/tts/synthesize endpoint."""

import pytest
from unittest.mock import AsyncMock, patch

try:
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.services.tts_service import tts_service
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False


@pytest.mark.skipif(not HAS_DEPS, reason="FastAPI or HTTPX not installed in local environment")
@pytest.mark.asyncio
async def test_tts_synthesize_success():
    """Verifies that /api/tts/synthesize returns 200 OK with audio/wav."""
    with patch.object(tts_service, "available", True), \
         patch.object(tts_service, "synthesize", new_callable=AsyncMock) as mock_synth:
        mock_synth.return_value = b"RIFF_MOCK_WAV_BYTES_DATA"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/tts/synthesize",
                json={"text": "Hello, this is a test speech synthesis.", "message_id": "msg-123"},
            )
            assert res.status_code == 200
            assert res.headers["content-type"] == "audio/wav"
            assert "speech.wav" in res.headers["content-disposition"]
            assert res.content == b"RIFF_MOCK_WAV_BYTES_DATA"
            assert "x-synthesis-duration-ms" in res.headers
            mock_synth.assert_awaited_once_with("Hello, this is a test speech synthesis.")


@pytest.mark.skipif(not HAS_DEPS, reason="FastAPI or HTTPX not installed in local environment")
@pytest.mark.asyncio
async def test_tts_synthesize_service_unavailable():
    """Verifies that 503 is returned when model weights are not loaded."""
    with patch.object(tts_service, "available", False), \
         patch.object(tts_service, "error_reason", "Model weights missing"):

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/tts/synthesize",
                json={"text": "Hello, speech test."},
            )
            assert res.status_code == 503
            data = res.json()
            assert "Model weights missing" in data["detail"]


@pytest.mark.skipif(not HAS_DEPS, reason="FastAPI or HTTPX not installed in local environment")
@pytest.mark.asyncio
async def test_tts_synthesize_non_speakable_text():
    """Verifies that 400 is returned when cleaned text contains no speakable content."""
    with patch.object(tts_service, "available", True), \
         patch.object(tts_service, "synthesize", new_callable=AsyncMock) as mock_synth:
        mock_synth.side_effect = ValueError("No speakable English prose found in the provided text.")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/tts/synthesize",
                json={"text": "```python\nprint(1)\n```"},
            )
            assert res.status_code == 400
            data = res.json()
            assert "No speakable English prose" in data["detail"]


@pytest.mark.skipif(not HAS_DEPS, reason="FastAPI or HTTPX not installed in local environment")
@pytest.mark.asyncio
async def test_tts_synthesize_exceeds_max_length():
    """Verifies that 422 Unprocessable Entity is returned when text exceeds 3000 chars."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/tts/synthesize",
            json={"text": "a" * 3001},
        )
        assert res.status_code == 422
