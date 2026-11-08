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
            "torch": MagicMock(),
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

    def test_environment_check_missing_config_file_when_no_bundled(self):
        # Has weight file and voices directory, but no config.json and bundled is missing
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        with patch.dict("sys.modules", self.mock_deps):
            with patch("pathlib.Path.is_file", autospec=True) as mock_is_file:
                def fake_is_file(path_obj):
                    if path_obj.name == "kokoro-v1_0.pth":
                        return True
                    return False
                mock_is_file.side_effect = fake_is_file
                service = TTSService(model_dir=str(self.model_path))
                self.assertFalse(service.available)
                self.assertIn("config.json", str(service.error_reason))

    def test_environment_check_auto_heals_missing_config_from_bundled(self):
        # Has weight file and voices directory, but no config.json in model_dir
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        self.assertFalse((self.model_path / "config.json").exists())

        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertTrue(service.available)
            self.assertIsNone(service.error_reason)
            self.assertTrue((self.model_path / "config.json").exists())

    def test_environment_check_resolved_successfully(self):
        # Has weight file, voices directory, and config.json
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        (self.model_path / "config.json").touch()
        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            self.assertTrue(service.available)
            self.assertIsNone(service.error_reason)
            self.assertEqual(service.weights_path, self.model_path / "kokoro-v1_0.pth")

    def test_environment_check_fallback_to_v019(self):
        # Has v0.19 weight file, voices directory, and config.json
        (self.model_path / "kokoro-v0_19.pth").touch()
        (self.model_path / "voices").mkdir()
        (self.model_path / "config.json").touch()
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
        (self.model_path / "config.json").touch()

        with patch.dict("sys.modules", self.mock_deps):
            service = TTSService(model_dir=str(self.model_path))
            service.pipeline = MagicMock()

            with self.assertRaises(ValueError):
                service._synthesize_sync("```python\nprint(1)\n```")

    def test_synthesize_success_packs_wav_with_local_voice_file(self):
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        (self.model_path / "voices" / "af_heart.pt").touch()
        (self.model_path / "config.json").touch()

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

        mock_torch = MagicMock()
        mock_voice_tensor = MagicMock()
        mock_torch.load.return_value = mock_voice_tensor

        deps = {
            "soundfile": mock_sf,
            "kokoro": mock_kokoro,
            "numpy": mock_numpy,
            "torch": mock_torch,
        }

        with patch.dict("sys.modules", deps):
            service = TTSService(model_dir=str(self.model_path))
            service.pipeline = mock_pipeline_inst

            audio_bytes = asyncio.run(service.synthesize("Hello, this is a test."))
            self.assertEqual(audio_bytes, b"RIFF_FAKE_WAV_BYTES")
            mock_pipeline_inst.assert_called_once()
            # Local voice file loaded as tensor into voice parameter
            mock_torch.load.assert_called_once_with(
                str(self.model_path / "voices" / "af_heart.pt"),
                weights_only=True,
                map_location="cpu",
            )
            self.assertEqual(mock_pipeline_inst.call_args[1]["voice"], mock_voice_tensor)
            self.assertEqual(mock_pipeline_inst.call_args[1]["speed"], 1)

    def test_synthesize_converts_torch_tensor_chunks_to_numpy(self):
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        (self.model_path / "config.json").touch()

        mock_tensor = MagicMock()
        mock_tensor.__len__.return_value = 10
        mock_numpy_arr = MagicMock()
        mock_tensor.detach.return_value.cpu.return_value.numpy.return_value = mock_numpy_arr

        mock_kokoro = MagicMock()
        mock_pipeline_inst = MagicMock()
        mock_pipeline_inst.return_value = [("graphemes", "phonemes", mock_tensor)]

        mock_sf = MagicMock()
        mock_sf.write.side_effect = lambda buf, d, sr, format, subtype: buf.write(b"RIFF_WAV")

        mock_numpy = MagicMock()
        mock_numpy.concatenate.return_value = mock_numpy_arr

        deps = {
            "soundfile": mock_sf,
            "kokoro": mock_kokoro,
            "numpy": mock_numpy,
            "torch": MagicMock(),
        }

        with patch.dict("sys.modules", deps):
            service = TTSService(model_dir=str(self.model_path))
            service.pipeline = mock_pipeline_inst

            audio_bytes = asyncio.run(service.synthesize("Testing tensor detach."))
            self.assertEqual(audio_bytes, b"RIFF_WAV")
            mock_tensor.detach.assert_called_once()
            mock_numpy.concatenate.assert_called_once_with([mock_numpy_arr])

    def test_synthesize_fallback_voice_when_file_missing(self):
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        (self.model_path / "config.json").touch()
        # No af_heart.pt

        fake_audio = [0.1, 0.2]
        mock_kokoro = MagicMock()
        mock_pipeline_inst = MagicMock()
        mock_pipeline_inst.return_value = [("graphemes", "phonemes", fake_audio)]

        mock_sf = MagicMock()
        mock_sf.write.side_effect = lambda buf, d, sr, format, subtype: buf.write(b"RIFF_WAV")

        mock_numpy = MagicMock()
        mock_numpy.concatenate.return_value = fake_audio

        deps = {
            "soundfile": mock_sf,
            "kokoro": mock_kokoro,
            "numpy": mock_numpy,
            "torch": MagicMock(),
        }

        with patch.dict("sys.modules", deps):
            service = TTSService(model_dir=str(self.model_path))
            service.pipeline = mock_pipeline_inst

            audio_bytes = asyncio.run(service.synthesize("Hello"))
            self.assertEqual(audio_bytes, b"RIFF_WAV")
            self.assertEqual(mock_pipeline_inst.call_args[1]["voice"], "af_heart")

    def test_load_model_initializes_with_kmodel_and_local_config(self):
        (self.model_path / "kokoro-v1_0.pth").touch()
        (self.model_path / "voices").mkdir()
        (self.model_path / "config.json").touch()

        mock_kokoro = MagicMock()
        mock_kmodel_cls = MagicMock()
        mock_kpipeline_cls = MagicMock()
        mock_kokoro.KModel = mock_kmodel_cls
        mock_kokoro.KPipeline = mock_kpipeline_cls

        deps = {
            "soundfile": MagicMock(),
            "kokoro": mock_kokoro,
            "numpy": MagicMock(),
            "torch": MagicMock(),
        }

        with patch.dict("sys.modules", deps):
            service = TTSService(model_dir=str(self.model_path))
            service._load_model()

            # Verify KModel was instantiated with local config and model weights
            mock_kmodel_cls.assert_called_once_with(
                config=str(self.model_path / "config.json"),
                model=str(self.model_path / "kokoro-v1_0.pth"),
            )
            # Verify KPipeline was instantiated with model=kmodel and NOT model_path
            mock_kpipeline_cls.assert_called_once()
            call_kwargs = mock_kpipeline_cls.call_args[1]
            self.assertIn("model", call_kwargs)
            self.assertNotIn("model_path", call_kwargs)
            self.assertEqual(call_kwargs["device"], "cpu")


if __name__ == "__main__":
    unittest.main()
