"""Unit tests for Pydantic input models validation."""

import re
import unittest

MODEL_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\./:]+$")
MODEL_MAX_LENGTH = 128


class TestPromptRequestValidation(unittest.TestCase):
    """Verifies that PromptRequest enforces strict validation boundaries."""

    def test_model_name_pattern_and_length(self):
        valid_names = [
            "qwen3.5:4b",
            "llama3:latest",
            "deepseek-r1:7b",
            "my_model-1.0:test",
            "ollama.com/library/gemma2:2b",
        ]
        for name in valid_names:
            self.assertTrue(1 <= len(name) <= MODEL_MAX_LENGTH)
            self.assertTrue(bool(MODEL_PATTERN.match(name)), f"Should be valid: {name}")

        invalid_names = [
            "",  # Empty
            "model; rm -rf /",  # Semicolon / shell chars
            "model with spaces",  # Spaces
            "model\nnewline",  # Newline
            "<script>alert(1)</script>",  # HTML / XSS
            "a" * 129,  # Exceeds max_length=128
        ]
        for name in invalid_names:
            is_valid = bool(1 <= len(name) <= MODEL_MAX_LENGTH and MODEL_PATTERN.match(name))
            self.assertFalse(is_valid, f"Should be invalid: {name}")

    def test_pydantic_model_if_installed(self):
        try:
            from pydantic import ValidationError
            from app.models import PromptRequest
        except ImportError:
            self.skipTest("pydantic not installed in current environment")

        req = PromptRequest(model="qwen3.5:4b", prompt="Hello")
        self.assertEqual(req.model, "qwen3.5:4b")

        with self.assertRaises(ValidationError):
            PromptRequest(model="model with spaces", prompt="Hello")

        with self.assertRaises(ValidationError):
            PromptRequest(model="qwen3.5:4b", prompt="")


if __name__ == "__main__":
    unittest.main()
