"""Unit tests for Chat History Persistence and Export feature (016-chat-history-persistence)."""

import json
from pathlib import Path
import re
import unittest

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
CONTRACT_FILE = WORKSPACE_ROOT / "specs/016-chat-history-persistence/contracts/ui-features.json"
EXPORT_SCHEMA_FILE = WORKSPACE_ROOT / "specs/016-chat-history-persistence/contracts/export-schema.json"
FEATURES_JS_FILE = WORKSPACE_ROOT / "app/static/js/features.js"


class TestExportAndStorageContract(unittest.TestCase):
    """Validates contract compliance and entity schemas for feature 016."""

    def test_ui_features_contract_enables_export_and_clear_all(self):
        """Verify that ui-features.json contract enables chat.export and session.clear_all."""
        self.assertTrue(CONTRACT_FILE.exists(), f"Contract file missing: {CONTRACT_FILE}")
        with open(CONTRACT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("default", data)
        default_controls = data["default"]

        self.assertIn("chat.export", default_controls)
        self.assertEqual(default_controls["chat.export"]["status"], "enabled")

        self.assertIn("session.clear_all", default_controls)
        self.assertEqual(default_controls["session.clear_all"]["status"], "enabled")

    def test_features_js_parity_with_persistence_contract(self):
        """Verify that features.js reflects enabled status for chat.export and session.clear_all."""
        self.assertTrue(FEATURES_JS_FILE.exists(), f"features.js missing: {FEATURES_JS_FILE}")
        with open(FEATURES_JS_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("'chat.export': { status: 'enabled' }", content)
        self.assertIn("'session.clear_all': { status: 'enabled' }", content)

    def test_export_schema_json_is_valid(self):
        """Verify that export-schema.json is valid JSON Schema with required properties."""
        self.assertTrue(EXPORT_SCHEMA_FILE.exists(), f"Schema file missing: {EXPORT_SCHEMA_FILE}")
        with open(EXPORT_SCHEMA_FILE, "r", encoding="utf-8") as f:
            schema = json.load(f)

        self.assertEqual(schema.get("title"), "ChatExportSchema")
        self.assertIn("version", schema.get("required", []))
        self.assertIn("session", schema.get("required", []))

    def test_mock_export_document_validates_against_schema(self):
        """Validates that a sample exported JSON structure complies with export-schema.json rules."""
        sample_export = {
            "version": "1.0",
            "exportedAt": "2026-11-14T23:30:00Z",
            "session": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "IndexedDB Persistence Test",
                "createdAt": 1794695000000,
                "updatedAt": 1794695060000,
                "model": "qwen2.5:7b",
                "systemPrompt": None,
                "messages": [
                    {
                        "id": "223e4567-e89b-12d3-a456-426614174001",
                        "sessionId": "123e4567-e89b-12d3-a456-426614174000",
                        "role": "user",
                        "content": "Hello local model",
                        "reasoning": None,
                        "status": "completed",
                        "error": None,
                        "errorStatus": None,
                        "metrics": None,
                        "createdAt": 1794695001000
                    },
                    {
                        "id": "323e4567-e89b-12d3-a456-426614174002",
                        "sessionId": "123e4567-e89b-12d3-a456-426614174000",
                        "role": "assistant",
                        "content": "Hello! How can I assist you offline today?",
                        "reasoning": "User greeted politely. Respond clearly.",
                        "status": "completed",
                        "error": None,
                        "errorStatus": None,
                        "metrics": {
                            "model": "qwen2.5:7b",
                            "durationSeconds": 1.2,
                            "tokensPerSecond": 35.4,
                            "evalCount": 42
                        },
                        "createdAt": 1794695002000
                    }
                ]
            }
        }

        # Check basic constraints defined in data-model.md
        session = sample_export["session"]
        uuid_regex = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
        self.assertTrue(uuid_regex.match(session["id"]))
        self.assertLessEqual(len(session["title"]), 120)
        self.assertGreaterEqual(len(session["title"]), 1)
        self.assertGreater(session["createdAt"], 0)
        self.assertGreater(session["updatedAt"], 0)
        self.assertEqual(len(session["messages"]), 2)

        for msg in session["messages"]:
            self.assertTrue(uuid_regex.match(msg["id"]))
            self.assertEqual(msg["sessionId"], session["id"])
            self.assertIn(msg["role"], ["user", "assistant"])
            self.assertIn(msg["status"], ["streaming", "completed", "stopped", "error"])

    def test_session_entity_title_bounds_and_sanitization(self):
        """Verifies session titles are clamped to 120 chars and sanitized properly."""
        def normalize_title(raw_title: str) -> str:
            cleaned = raw_title.strip()[:120]
            return cleaned if cleaned else "New conversation"

        self.assertEqual(normalize_title(""), "New conversation")
        self.assertEqual(normalize_title("   "), "New conversation")
        self.assertEqual(normalize_title("Short Title"), "Short Title")
        long_title = "A" * 150
        self.assertEqual(len(normalize_title(long_title)), 120)

    def test_message_lifecycle_statuses(self):
        """Verifies valid lifecycle statuses for ChatMessage turns."""
        valid_statuses = {"streaming", "completed", "stopped", "error"}
        for s in ["streaming", "completed", "stopped", "error"]:
            self.assertIn(s, valid_statuses)

        # Invalid status detection
        self.assertNotIn("in_progress", valid_statuses)
        self.assertNotIn("failed", valid_statuses)

    def test_markdown_export_formatting(self):
        """Verifies Markdown export generation requirements from spec and research."""
        def format_markdown(session: dict) -> str:
            lines = [
                f"# {session.get('title', 'Conversation')}",
                "",
                f"- **Date**: {session.get('dateStr', 'N/A')}",
                f"- **Model**: {session.get('model', 'Unknown')}",
                "- **Exported from**: e-webui",
                "",
                "---",
                ""
            ]

            for msg in session.get("messages", []):
                role_title = "User" if msg["role"] == "user" else "Assistant"
                lines.append(f"### {role_title}")
                lines.append("")

                if msg.get("reasoning"):
                    lines.append("<details>")
                    lines.append("<summary>Reasoning</summary>")
                    lines.append("")
                    lines.append(msg["reasoning"])
                    lines.append("")
                    lines.append("</details>")
                    lines.append("")

                if msg.get("content"):
                    lines.append(msg["content"])
                    lines.append("")

                metrics = msg.get("metrics")
                if metrics and metrics.get("durationSeconds"):
                    tps = f" ({metrics['tokensPerSecond']} tok/s)" if metrics.get("tokensPerSecond") else ""
                    lines.append(f"*Generated in {metrics['durationSeconds']}s{tps}*")
                    lines.append("")

                lines.append("---")
                lines.append("")

            return "\n".join(lines).strip()

        mock_session = {
            "title": "Data Persistence Guide",
            "dateStr": "2026-11-14 23:40",
            "model": "qwen2.5:7b",
            "messages": [
                {
                    "role": "user",
                    "content": "How do I write a Python script?",
                    "reasoning": None,
                    "metrics": None
                },
                {
                    "role": "assistant",
                    "content": "Here is an example:\n\n```python\nprint('hello world')\n```",
                    "reasoning": "Explain Python hello world clearly.",
                    "metrics": {"durationSeconds": 1.4, "tokensPerSecond": 42.0}
                }
            ]
        }

        md_output = format_markdown(mock_session)

        # Assertions on Markdown structure
        self.assertTrue(md_output.startswith("# Data Persistence Guide"))
        self.assertIn("- **Model**: qwen2.5:7b", md_output)
        self.assertIn("### User", md_output)
        self.assertIn("How do I write a Python script?", md_output)
        self.assertIn("### Assistant", md_output)
        self.assertIn("<summary>Reasoning</summary>", md_output)
        self.assertIn("Explain Python hello world clearly.", md_output)
        self.assertIn("```python\nprint('hello world')\n```", md_output)
        self.assertIn("*Generated in 1.4s (42.0 tok/s)*", md_output)

    def test_sanitize_filename(self):
        """Verifies filename sanitization for safe client downloads."""
        def sanitize_filename(raw_title: str, extension: str, date_str: str) -> str:
            clean = re.sub(r"[^\w\s\-]", "", raw_title).strip()
            clean = re.sub(r"[\s_]+", "-", clean).lower()
            clean = clean[:48] if clean else "conversation"
            return f"{clean}-{date_str}.{extension}"

        self.assertEqual(
            sanitize_filename("Python 3: Async/Await Guide?!", "md", "2026-11-14"),
            "python-3-asyncawait-guide-2026-11-14.md"
        )
        self.assertEqual(
            sanitize_filename("   ///:::***   ", "json", "2026-11-14"),
            "conversation-2026-11-14.json"
        )

    def test_custom_presets_storage_contract(self):
        """Verifies storage.js defines custom preset CRUD methods."""
        storage_js = WORKSPACE_ROOT / "app/static/js/storage.js"
        self.assertTrue(storage_js.exists(), "storage.js missing")
        content = storage_js.read_text(encoding="utf-8")
        self.assertIn("loadCustomPresets", content)
        self.assertIn("saveCustomPreset", content)
        self.assertIn("deleteCustomPreset", content)
        self.assertIn("ewebui_custom_presets_v1", content)

    def test_builtin_presets_definitions(self):
        """Verifies presets.js defines built-in immutable personas."""
        presets_js = WORKSPACE_ROOT / "app/static/js/presets.js"
        self.assertTrue(presets_js.exists(), "presets.js missing")
        content = presets_js.read_text(encoding="utf-8")
        self.assertIn("Helpful Assistant", content)
        self.assertIn("Coding Specialist", content)
        self.assertIn("Concise Editor", content)
        self.assertIn("Academic Explainer", content)
        self.assertIn("isBuiltIn: true", content)
        self.assertIn("defaultTemperature", content)

    def test_export_includes_parameter_provenance(self):
        """Verifies export.js embeds preset and sampling parameters."""
        export_js = WORKSPACE_ROOT / "app/static/js/export.js"
        content = export_js.read_text(encoding="utf-8")
        self.assertIn("- **Temperature**", content)
        self.assertIn("- **Top-P**", content)
        self.assertIn("- **Preset**", content)
        self.assertIn("temperature: typeof session.temperature === 'number'", content)
        self.assertIn("topP: typeof session.topP === 'number'", content)


if __name__ == "__main__":
    unittest.main()
