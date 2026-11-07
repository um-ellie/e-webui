"""Unit tests for text normalization and speech cleaning."""

import unittest
from app.services.text_cleaner import clean_text, has_speakable_content


class TestTextCleaner(unittest.TestCase):
    def test_clean_text_removes_fenced_code_blocks(self):
        raw = (
            "Here is the solution in Python:\n\n"
            "```python\ndef reverse_list(lst):\n    return lst[::-1]\n```\n\n"
            "It uses slice notation to reverse the elements."
        )
        cleaned = clean_text(raw)
        self.assertNotIn("def reverse_list", cleaned)
        self.assertNotIn("lst[::-1]", cleaned)
        self.assertIn("Here is the solution in Python:", cleaned)
        self.assertIn("It uses slice notation to reverse the elements.", cleaned)

    def test_clean_text_preserves_inline_code(self):
        raw = "You can use the `reverse()` method or `[::-1]` slice."
        cleaned = clean_text(raw)
        self.assertNotIn("`", cleaned)
        self.assertEqual("You can use the reverse() method or [::-1] slice.", cleaned)

    def test_clean_text_preserves_link_anchor_and_removes_raw_urls(self):
        raw = "Check the [Python Docs](https://docs.python.org/3) or visit https://example.com directly."
        cleaned = clean_text(raw)
        self.assertIn("Python Docs", cleaned)
        self.assertNotIn("https://docs.python.org/3", cleaned)
        self.assertNotIn("https://example.com", cleaned)
        self.assertEqual("Check the Python Docs or visit directly.", cleaned)

    def test_clean_text_strips_markdown_formatting(self):
        raw = "# Header Title\n\n> A famous quote\n\nThis is **bold**, *italic*, and ~~strikethrough~~."
        cleaned = clean_text(raw)
        self.assertNotIn("#", cleaned)
        self.assertNotIn(">", cleaned)
        self.assertNotIn("*", cleaned)
        self.assertNotIn("~", cleaned)
        self.assertEqual("Header Title A famous quote This is bold, italic, and strikethrough.", cleaned)

    def test_clean_text_strips_emojis(self):
        raw = "Great job! 👍🎉 Let's continue working. 🚀"
        cleaned = clean_text(raw)
        self.assertNotIn("👍", cleaned)
        self.assertNotIn("🎉", cleaned)
        self.assertNotIn("🚀", cleaned)
        self.assertEqual("Great job! Let's continue working.", cleaned)

    def test_clean_text_collapses_whitespace(self):
        raw = "First line.\n\n\n   Second line with   extra   spaces."
        cleaned = clean_text(raw)
        self.assertEqual("First line. Second line with extra spaces.", cleaned)

    def test_has_speakable_content_code_only(self):
        raw = "```bash\necho 'hello world'\nexit 0\n```"
        self.assertEqual("", clean_text(raw))
        self.assertFalse(has_speakable_content(raw))

    def test_has_speakable_content_symbols_or_numbers_only(self):
        self.assertFalse(has_speakable_content("12345"))
        self.assertFalse(has_speakable_content("..."))
        self.assertFalse(has_speakable_content("👍👍👍"))
        self.assertFalse(has_speakable_content("   \n\t  "))

    def test_has_speakable_content_single_word(self):
        self.assertTrue(has_speakable_content("Yes."))
        self.assertTrue(has_speakable_content("Hello"))
        self.assertEqual("Yes.", clean_text("Yes."))
        self.assertEqual("Hello", clean_text("Hello"))

    def test_clean_text_strips_markdown_tables(self):
        raw = (
            "Here is a table:\n\n"
            "| Feature | Status |\n"
            "|---|---|\n"
            "| Speed | Fast |\n"
            "| Voice | Natural |\n"
        )
        cleaned = clean_text(raw)
        self.assertNotIn("|", cleaned)
        self.assertNotIn("---", cleaned)
        self.assertIn("Feature Status", cleaned)
        self.assertIn("Speed Fast", cleaned)

    def test_clean_text_handles_unclosed_fenced_code_blocks(self):
        raw = "Look at this code:\n```python\nprint('unclosed code block')"
        cleaned = clean_text(raw)
        self.assertNotIn("print('unclosed code block')", cleaned)
        self.assertEqual("Look at this code:", cleaned)

    def test_has_speakable_content_persian_only(self):
        # Persian text contains no Latin characters [a-zA-Z]
        raw = "سلام! حال شما چطوره؟"
        self.assertFalse(has_speakable_content(raw))


if __name__ == "__main__":
    unittest.main()
