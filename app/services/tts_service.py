"""In-process Kokoro-82M Text-to-Speech service running on CPU."""

import asyncio
import io
import logging
import os
from pathlib import Path
from typing import Optional

from app.config import KOKORO_MODEL_DIR
from app.services.text_cleaner import clean_text, has_speakable_content

logger = logging.getLogger("e-webui.tts")


class TTSService:
    """Manages Kokoro-82M TTS model lifecycle, lazy initialization, and non-blocking CPU synthesis."""

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = Path(model_dir or KOKORO_MODEL_DIR)
        self.pipeline = None
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(1)
        self.weights_path: Optional[Path] = None
        self.voice_tensor: Optional[object] = None
        self.available: bool = False
        self.error_reason: Optional[str] = None

        self._check_environment()

    def _check_environment(self):
        """Checks whether Kokoro dependencies and local model weights are present."""
        try:
            import soundfile  # noqa: F401
        except ImportError:
            self.available = False
            self.error_reason = "soundfile package is not installed."
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        try:
            import numpy  # noqa: F401
        except ImportError:
            self.available = False
            self.error_reason = "numpy package is not installed."
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        try:
            import torch  # noqa: F401
        except ImportError:
            self.available = False
            self.error_reason = "torch package is not installed."
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        try:
            import kokoro  # noqa: F401
        except ImportError:
            self.available = False
            self.error_reason = "kokoro package is not installed."
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        # Check weights file
        v1_path = self.model_dir / "kokoro-v1_0.pth"
        v019_path = self.model_dir / "kokoro-v0_19.pth"

        if v1_path.is_file():
            self.weights_path = v1_path
        elif v019_path.is_file():
            self.weights_path = v019_path
        else:
            self.available = False
            self.error_reason = (
                f"Model weights (kokoro-v1_0.pth or kokoro-v0_19.pth) not found in {self.model_dir}"
            )
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        # Check voices directory
        voices_dir = self.model_dir / "voices"
        if not voices_dir.is_dir():
            self.available = False
            self.error_reason = f"Voices directory not found in {self.model_dir}"
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        if not any(voices_dir.glob("*.pt")):
            self.available = False
            self.error_reason = f"No voice profile embeddings (*.pt) found in {voices_dir}"
            logger.warning(f"TTS unavailable: {self.error_reason}")
            return

        # Check architecture config file (shared directory or bundled repository fallback)
        config_path = self.model_dir / "config.json"
        bundled_config = Path(__file__).resolve().parent.parent / "resources" / "kokoro" / "config.json"

        if not config_path.is_file():
            if bundled_config.is_file():
                # Attempt to auto-populate missing config in shared model storage
                try:
                    import shutil
                    self.model_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(bundled_config, config_path)
                    logger.info(f"Self-healed missing config: copied {bundled_config} to {config_path}")
                except Exception as e:
                    logger.debug(f"Could not copy bundled config to {config_path} ({e}); using bundled path.")
            else:
                self.available = False
                self.error_reason = f"Model config (config.json) not found in {self.model_dir} or {bundled_config}"
                logger.warning(f"TTS unavailable: {self.error_reason}")
                return

        self.available = True
        self.error_reason = None
        logger.info(f"TTS service ready. Resolved model weights at: {self.weights_path}")

    def _load_model(self):
        """Loads Kokoro pipeline into memory synchronously."""
        if self.pipeline is not None:
            return

        logger.info(f"Lazily loading Kokoro model from {self.weights_path} on CPU...")
        # Ensure offline mode
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

        config_path = self.model_dir / "config.json"
        bundled_config = Path(__file__).resolve().parent.parent / "resources" / "kokoro" / "config.json"

        resolved_config = None
        if config_path.is_file():
            resolved_config = config_path
        elif bundled_config.is_file():
            resolved_config = bundled_config
        else:
            raise RuntimeError(f"Kokoro model config.json not found in {self.model_dir} or {bundled_config}")

        try:
            from kokoro import KModel, KPipeline

            kmodel = KModel(config=str(resolved_config), model=str(self.weights_path))
            if hasattr(kmodel, "to"):
                kmodel = kmodel.to("cpu")
            if hasattr(kmodel, "eval"):
                kmodel = kmodel.eval()
            self.pipeline = KPipeline(lang_code="a", model=kmodel, device="cpu", repo_id=None)
        except (ImportError, AttributeError, TypeError) as exc:
            logger.debug(f"KModel initialization fallback: {exc}")
            from kokoro import KPipeline

            self.pipeline = KPipeline(lang_code="a", model=str(self.weights_path), device="cpu")

        logger.info("Kokoro model loaded successfully.")

    def _resolve_voice_file(self) -> Path:
        """Resolves the best available local voice embedding file (*.pt)."""
        voices_dir = self.model_dir / "voices"

        # 1. Preferred primary voice (af_heart.pt per Spec 015)
        primary_voice = voices_dir / "af_heart.pt"
        if primary_voice.is_file():
            return primary_voice

        # 2. Preferred fallback American female voices
        preferred_fallbacks = ["af_sarah.pt", "af_nicole.pt", "af_bella.pt"]
        for voice_name in preferred_fallbacks:
            candidate = voices_dir / voice_name
            if candidate.is_file():
                logger.info(f"af_heart.pt not found; falling back to preferred voice: {voice_name}")
                return candidate

        # 3. Any available American voice (af_* or am_*)
        american_voices = sorted(voices_dir.glob("a*.pt"))
        if american_voices:
            logger.info(f"af_heart.pt not found; falling back to American voice: {american_voices[0].name}")
            return american_voices[0]

        # 4. Any available *.pt file
        all_voices = sorted(voices_dir.glob("*.pt"))
        if all_voices:
            logger.info(f"af_heart.pt not found; falling back to available voice: {all_voices[0].name}")
            return all_voices[0]

        raise FileNotFoundError(f"No voice files (*.pt) found in {voices_dir}")

    def _synthesize_sync(self, text: str) -> bytes:
        """Performs CPU-bound speech synthesis and packs audio into 24kHz PCM WAV."""
        import numpy as np
        import soundfile as sf
        import torch

        self._load_model()

        cleaned = clean_text(text)
        if not has_speakable_content(cleaned):
            raise ValueError("No speakable English prose found in the provided text.")

        # Resolve voice path or preloaded tensor to prevent online Hugging Face download attempts
        if self.voice_tensor is None:
            voice_file = self._resolve_voice_file()
            try:
                self.voice_tensor = torch.load(str(voice_file), weights_only=True, map_location="cpu")
                logger.info(f"Loaded voice tensor from {voice_file}")
            except Exception as e:
                logger.warning(f"Failed to pre-load voice tensor from {voice_file}: {e}")
                self.voice_tensor = str(voice_file)

        generator = self.pipeline(cleaned, voice=self.voice_tensor, speed=1)

        audio_segments = []
        for _, _, audio in generator:
            if audio is not None and len(audio) > 0:
                if hasattr(audio, "detach"):
                    audio = audio.detach().cpu().numpy()
                elif hasattr(audio, "numpy"):
                    audio = audio.numpy()
                else:
                    audio = np.asarray(audio, dtype=np.float32)
                audio_segments.append(audio)

        if not audio_segments:
            raise RuntimeError("TTS pipeline generated zero audio frames.")

        combined_audio = np.concatenate(audio_segments)

        out_buffer = io.BytesIO()
        sf.write(out_buffer, combined_audio, 24000, format="WAV", subtype="PCM_16")
        return out_buffer.getvalue()

    async def synthesize(self, text: str) -> bytes:
        """Asynchronously executes speech synthesis on a worker thread with concurrency limiting."""
        if not self.available:
            raise RuntimeError(self.error_reason or "TTS service is currently unavailable.")

        # Limit concurrent CPU synthesis to 1 task to avoid starving chat streaming
        async with self._semaphore:
            async with self._lock:
                if self.pipeline is None:
                    await asyncio.to_thread(self._load_model)

            return await asyncio.to_thread(self._synthesize_sync, text)


# Global singleton
tts_service = TTSService()
