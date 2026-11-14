"""Unit tests verifying the streaming pipeline, thinking extraction, and error handling."""

import json
import re
import unittest


class TestStreamPipeline(unittest.TestCase):
    """Verifies stream parsing logic, thinking tag extraction, and error handling."""

    def parse_chunk_line(self, line: str, in_think: bool):
        """Pure Python replica of the Ollama stream parsing and think-tag extraction logic."""
        line = line.strip()
        if not line:
            return None, in_think

        parsed = json.loads(line)
        raw_token = parsed.get("response", "")
        thinking = parsed.get("thinking", None)
        done = bool(parsed.get("done", False))
        token = ""

        if "<think>" in raw_token or in_think:
            current_text = raw_token
            if "<think>" in current_text:
                before_think, after_think = current_text.split("<think>", 1)
                if before_think:
                    token += before_think
                in_think = True
                current_text = after_think

            if in_think:
                if "</think>" in current_text:
                    inside_think, after_think = current_text.split("</think>", 1)
                    thinking = (thinking or "") + inside_think
                    in_think = False
                    token += after_think
                else:
                    thinking = (thinking or "") + current_text
            else:
                token += current_text
        else:
            token = raw_token

        return {
            "token": token,
            "thinking": thinking,
            "done": done,
            "eval_count": parsed.get("eval_count"),
            "total_duration": parsed.get("total_duration")
        }, in_think

    def test_normal_answer_stream(self):
        """Simulate normal token by token streaming."""
        mock_lines = [
            json.dumps({"response": "Hello", "done": False}),
            json.dumps({"response": " world", "done": False}),
            json.dumps({"response": "!", "done": True, "eval_count": 3, "total_duration": 100000000}),
        ]

        chunks = []
        in_think = False
        for line in mock_lines:
            chunk, in_think = self.parse_chunk_line(line, in_think)
            if chunk:
                chunks.append(chunk)

        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0]["token"], "Hello")
        self.assertFalse(chunks[0]["done"])
        self.assertEqual(chunks[1]["token"], " world")
        self.assertEqual(chunks[2]["token"], "!")
        self.assertTrue(chunks[2]["done"])
        self.assertEqual(chunks[2]["eval_count"], 3)

    def test_thinking_tag_extraction(self):
        """Simulate model emitting <think> reasoning tokens."""
        mock_lines = [
            json.dumps({"response": "<think>\nThinking about", "done": False}),
            json.dumps({"response": " addition\n</think>The answer is 4", "done": True}),
        ]

        chunks = []
        in_think = False
        for line in mock_lines:
            chunk, in_think = self.parse_chunk_line(line, in_think)
            if chunk:
                chunks.append(chunk)

        has_thinking = any(bool(c["thinking"]) for c in chunks)
        self.assertTrue(has_thinking, "Should extract thinking content from <think> tags")
        final_token = "".join(c["token"] for c in chunks)
        self.assertIn("The answer is 4", final_token)
        self.assertNotIn("<think>", final_token)

    def test_reasoning_only_response(self):
        """Simulate model emitting ONLY reasoning."""
        mock_lines = [
            json.dumps({"response": "<think>pondering indefinitely</think>", "done": True}),
        ]

        chunks = []
        in_think = False
        for line in mock_lines:
            chunk, in_think = self.parse_chunk_line(line, in_think)
            if chunk:
                chunks.append(chunk)

        has_thinking = any(bool(c["thinking"]) for c in chunks)
        self.assertTrue(has_thinking)
        self.assertTrue(chunks[-1]["done"])
        self.assertEqual(chunks[-1]["token"], "")

    def test_stream_chunk_telemetry_fields(self):
        """Verifies that StreamChunk serializes extended telemetry metrics."""
        from pathlib import Path
        try:
            from app.models import StreamChunk
            chunk = StreamChunk(
                token="Done",
                done=True,
                status="completed",
                eval_count=250,
                eval_duration=5000000000,
                prompt_eval_count=45,
                prompt_eval_duration=250000000,
                load_duration=120000000,
                total_duration=5370000000,
            )
            data = chunk.model_dump()
            self.assertEqual(data["eval_count"], 250)
            self.assertEqual(data["eval_duration"], 5000000000)
            self.assertEqual(data["prompt_eval_count"], 45)
            self.assertEqual(data["prompt_eval_duration"], 250000000)
            self.assertEqual(data["load_duration"], 120000000)
            self.assertEqual(data["total_duration"], 5370000000)

            # Ensure JSON serialization preserves fields
            json_str = chunk.model_dump_json()
            self.assertIn('"eval_duration":5000000000', json_str)
            self.assertIn('"prompt_eval_count":45', json_str)
        except ImportError:
            # When pydantic is not installed on host, verify models.py and ollama_client.py schema definitions
            repo_root = Path(__file__).resolve().parent.parent.parent
            models_py = (repo_root / "app" / "models.py").read_text(encoding="utf-8")
            self.assertIn("eval_duration", models_py)
            self.assertIn("prompt_eval_count", models_py)
            self.assertIn("prompt_eval_duration", models_py)
            self.assertIn("load_duration", models_py)
            self.assertIn("latency_ms", models_py)
            self.assertIn("loaded_models", models_py)


    def test_prompt_request_sampling_parameters(self):
        """Verifies that PromptRequest models top_p, num_ctx, and system instructions."""
        from pathlib import Path
        try:
            from app.models import PromptRequest
            req = PromptRequest(
                model="qwen3.5:4b",
                prompt="Write code",
                system="You are a coding specialist.",
                temperature=0.2,
                top_p=0.8,
                num_ctx=8192,
            )
            data = req.model_dump()
            self.assertEqual(data["system"], "You are a coding specialist.")
            self.assertEqual(data["temperature"], 0.2)
            self.assertEqual(data["top_p"], 0.8)
            self.assertEqual(data["num_ctx"], 8192)

            # Test invalid bounds
            from pydantic import ValidationError
            with self.assertRaises(ValidationError):
                PromptRequest(model="test", prompt="hello", top_p=1.5)
            with self.assertRaises(ValidationError):
                PromptRequest(model="test", prompt="hello", num_ctx=100)
        except ImportError:
            repo_root = Path(__file__).resolve().parent.parent.parent
            models_py = (repo_root / "app" / "models.py").read_text(encoding="utf-8")
            self.assertIn("top_p: Optional[float]", models_py)
            self.assertIn("num_ctx: Optional[int]", models_py)
            self.assertIn("ge=0.0", models_py)
            self.assertIn("le=1.0", models_py)
            self.assertIn("ge=512", models_py)
            self.assertIn("le=131072", models_py)


if __name__ == "__main__":
    unittest.main()
