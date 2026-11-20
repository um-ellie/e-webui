"""Unit tests for TTS profile selection, venv resolution, and health reporting."""

import subprocess
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.tts_service import TTSService

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestTTSProfileResolution(unittest.TestCase):

    def test_venv_dir_for_hash_respects_profile(self):
        """Verify venv_dir_for_hash returns py3.11-... for tts and env-... for core."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/venv.sh"
        dir_core=$(venv_dir_for_hash "/opt/e-webui" "abcd1234efgh" "core")
        dir_tts=$(venv_dir_for_hash "/opt/e-webui" "abcd1234efgh" "tts")
        echo "CORE:$dir_core"
        echo "TTS:$dir_tts"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Script failed: {res.stderr}")
        self.assertIn("CORE:/opt/e-webui/venvs/env-abcd1234efgh", res.stdout)
        self.assertIn("TTS:/opt/e-webui/venvs/py3.11-abcd1234efgh", res.stdout)

    def test_health_response_schema_has_tts_fields(self):
        """Verify HealthResponse includes tts_available and tts_error fields."""
        try:
            from app.models import HealthResponse
        except ImportError:
            self.skipTest("pydantic not installed on host test runner")

        resp = HealthResponse(
            status="ok",
            ollama_connected=True,
            ollama_url="http://127.0.0.1:11434",
            tts_available=True,
            tts_error=None,
        )
        data = resp.model_dump()
        self.assertTrue(data["tts_available"])
        self.assertIsNone(data["tts_error"])

        resp_unavailable = HealthResponse(
            status="ok",
            ollama_connected=True,
            ollama_url="http://127.0.0.1:11434",
            tts_available=False,
            tts_error="soundfile package is not installed.",
        )
        data_unavail = resp_unavailable.model_dump()
        self.assertFalse(data_unavail["tts_available"])
        self.assertEqual(data_unavail["tts_error"], "soundfile package is not installed.")

    def test_tts_service_recheck_environment(self):
        """Verify TTSService.recheck_environment resets error_reason and rechecks."""
        service = TTSService(model_dir="/nonexistent/dir")
        self.assertFalse(service.available)
        self.assertIsNotNone(service.error_reason)

        recheck_res = service.recheck_environment()
        self.assertFalse(recheck_res)
        self.assertFalse(service.available)


if __name__ == "__main__":
    unittest.main()
