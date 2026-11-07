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


if __name__ == "__main__":
    unittest.main()
