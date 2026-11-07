"""Unit tests for OllamaClient using unittest."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

try:
    import httpx
    from app.models import PromptRequest
    from app.services.ollama_client import OllamaClient
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

MOCK_TAGS_RESPONSE = {
    "models": [
        {
            "name": "qwen3.5:4b",
            "model": "qwen3.5:4b",
            "modified_at": "2026-10-10T00:52:06Z",
            "size": 3324173934,
            "details": {
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


class TestOllamaClient(unittest.IsolatedAsyncioTestCase):
    """Verifies OllamaClient parsing and streaming."""

    def setUp(self):
        if not HTTPX_AVAILABLE:
            self.skipTest("httpx or pydantic not installed in environment")

    async def test_get_models_success(self):
        client = OllamaClient(base_url="http://test-ollama:11434")
        mock_response = httpx.Response(
            status_code=200,
            json=MOCK_TAGS_RESPONSE,
            request=httpx.Request("GET", "http://test-ollama:11434/api/tags"),
        )
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            result = await client.get_models()
            self.assertEqual(len(result.models), 2)
            self.assertEqual(result.models[0].name, "qwen3.5:4b")
            self.assertEqual(result.models[0].parameter_size, "4.2B")
            self.assertEqual(result.default_model, "qwen3.5:4b")

    async def test_check_health(self):
        client = OllamaClient(base_url="http://test-ollama:11434")
        mock_response = httpx.Response(
            status_code=200,
            text="Ollama is running",
            request=httpx.Request("GET", "http://test-ollama:11434/"),
        )
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            connected = await client.check_health()
            self.assertTrue(connected)
            mock_get.assert_called_once_with("http://test-ollama:11434/")

    async def test_stream_generate(self):
        client = OllamaClient(base_url="http://test-ollama:11434")
        req = PromptRequest(model="qwen3.5:4b", prompt="Why is the sky blue?")

        async def mock_aiter_lines():
            for chunk in MOCK_GENERATE_CHUNKS:
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
        mock_client.is_closed = False
        mock_client.stream.return_value = MockStreamContext()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch.object(client, "get_http_client", return_value=mock_client):
            collected_events = []
            async for sse_event in client.stream_generate(req):
                collected_events.append(sse_event)

            self.assertEqual(len(collected_events), 5)
            self.assertIn("The", collected_events[0])
            self.assertIn('"done":false', collected_events[0])
            self.assertIn('"done":true', collected_events[-1])


if __name__ == "__main__":
    unittest.main()
