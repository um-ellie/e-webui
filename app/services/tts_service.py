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

        self.available = True
        self.error_reason = None
        logger.info(f"TTS service ready. Resolved model weights at: {self.weights_path}")

    def _load_model(self):
        """Loads Kokoro pipeline into memory synchronously."""
        if self.pipeline is not None:
            return

        from kokoro import KPipeline

        logger.info(f"Lazily loading Kokoro model from {self.weights_path} on CPU...")
        # Ensure offline mode
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

        self.pipeline = KPipeline(lang_code="a", model_path=str(self.weights_path))
        logger.info("Kokoro model loaded successfully.")

    def _synthesize_sync(self, text: str) -> bytes:
        """Performs CPU-bound speech synthesis and packs audio into 24kHz PCM WAV."""
        import numpy as np
        import soundfile as sf

        self._load_model()

        cleaned = clean_text(text)
        if not has_speakable_content(cleaned):
            raise ValueError("No speakable English prose found in the provided text.")

        generator = self.pipeline(cleaned, voice="af_heart", speed=1)

        audio_segments = []
        for _, _, audio in generator:
            if audio is not None and len(audio) > 0:
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
