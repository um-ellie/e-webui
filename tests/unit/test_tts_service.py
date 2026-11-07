"""Unit tests for TTSService lifecycle and CPU synthesis."""

import asyncio
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.tts_service import TTSService


class TestTTSService(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.model_path = Path(self.temp_dir.name)
        self.mock_deps = {
            "soundfile": MagicMock(),
            "numpy": MagicMock(),
            "kokoro": MagicMock(),
        }

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_environment_check_missing_weights(self):
        # Empty directory: no weights file
        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertFalse(service.available)
            self.assertIn("Model weights", str(service.error_reason))

    def test_environment_check_missing_voices_dir(self):
        # Has weight file but no voices directory
        (self.model_path / "kokoro-v1_0.pth").touch()
        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertFalse(service.available)
            self.assertIn("Voices directory not found", str(service.error_reason))

    def test_environment_check_resolved_successfully(self):
        # Has weight file and voices directory
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertTrue(service.available)
            self.assertIsNone(service.error_reason)
            self.assertEqual(service.weights_path, self.model_path / "kokoro-v1_0.pth")

    def test_environment_check_fallback_to_v019(self):
        # Has v0.19 weight file and voices directory
        (self.model_path / "kokoro-v0_19.pth").touch()
        (self.model_path / "voices").mkdir()
        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertTrue(service.available)
            self.assertEqual(service.weights_path, self.model_path / "kokoro-v0_19.pth")

    def test_synthesize_when_unavailable_raises_runtime_error(self):
        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertFalse(service.available)

            with self.assertRaises(RuntimeError):
                asyncio.run(service.synthesize("Hello world"))

    def test_synthesize_non_speakable_text_raises_value_error(self):
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()

        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            service.pipeline = MagicMock()

            with self.assertRaises(ValueError):
                service._synthesize_sync("```python\nprint(1)\n```")

    def test_synthesize_success_packs_wav(self):
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()

        fake_audio = [0.1, 0.2, 0.3]

        mock_kokoro = MagicMock()
        mock_pipeline_inst = MagicMock()
        mock_pipeline_inst.return_value = [("graphemes", "phonemes", fake_audio)]

        mock_sf = MagicMock()

        def fake_write(buf, data, samplerate, format, subtype):
            buf.write(b"RIFF_FAKE_WAV_BYTES")

        mock_sf.write.side_effect = fake_write

        mock_numpy = MagicMock()
        mock_numpy.concatenate.return_value = fake_audio

        deps = {
            "soundfile": mock_sf,
            "kokoro": mock_kokoro,
            "numpy": mock_numpy,
        }

        with patch.dict("sys.modules", deps):
            service = TTSService(model_dir=str(self.model_path))
            service.pipeline = mock_pipeline_inst

            audio_bytes = asyncio.run(service.synthesize("Hello, this is a test."))
            self.assertEqual(audio_bytes, b"RIFF_FAKE_WAV_BYTES")
            mock_pipeline_inst.assert_called_once()
            self.assertEqual(mock_pipeline_inst.call_args[1]["voice"], "af_heart")
            self.assertEqual(mock_pipeline_inst.call_args[1]["speed"], 1)


if __name__ == "__main__":
    unittest.main()
