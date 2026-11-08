"""Unit tests verifying UI feature registry contracts and constraints."""

import json
from pathlib import Path
import unittest

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
CONTRACT_FILE = WORKSPACE_ROOT / "specs/013-chat-connection-refinements/contracts/ui-features.json"
FEATURES_JS_FILE = WORKSPACE_ROOT / "app/static/js/features.js"


class TestUIContracts(unittest.TestCase):
    """Verifies that ui-features contract and features.js match perfectly."""

    def test_ui_features_contract_exists_and_valid(self):
        """Verify that ui-features.json contract is present and valid JSON."""
        self.assertTrue(CONTRACT_FILE.exists(), f"Contract file missing: {CONTRACT_FILE}")
        with open(CONTRACT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("default", data)
        default_controls = data["default"]
        self.assertGreaterEqual(len(default_controls), 15)

        # Check key working controls
        self.assertEqual(default_controls["chat.send"]["status"], "enabled")
        self.assertEqual(default_controls["chat.stop"]["status"], "enabled")
        self.assertEqual(default_controls["chat.model_select"]["status"], "enabled")
        self.assertEqual(default_controls["session.new"]["status"], "enabled")

        # Check key future controls have disabled status and reason
        future_controls = [
            "chat.mic_input",
            "chat.manage_models",
            "chat.attach_file",
            "chat.tools_menu",
            "chat.export",
            "session.pin",
            "nav.library"
        ]
        for c in future_controls:
            self.assertIn(c, default_controls)
            self.assertEqual(default_controls[c]["status"], "disabled")
            self.assertGreater(len(default_controls[c].get("reason", "")), 0)

    def test_features_js_matches_contract(self):
        """Verify features.js has parity with the ui-features contract."""
        self.assertTrue(FEATURES_JS_FILE.exists(), f"features.js missing: {FEATURES_JS_FILE}")
        with open(FEATURES_JS_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        with open(CONTRACT_FILE, "r", encoding="utf-8") as f:
            contract_data = json.load(f)

        default_controls = contract_data["default"]

        for control_id, defn in default_controls.items():
            self.assertTrue(
                f"'{control_id}':" in content or f'"{control_id}":' in content,
                f"Missing control in features.js: {control_id}"
            )
            if defn["status"] == "disabled":
                reason = defn["reason"]
                self.assertIn(
                    reason,
                    content,
                    f"Missing disabled reason '{reason}' in features.js for {control_id}"
                )

    def test_composer_has_model_guard(self):
        """Verify that composer.js has a guard preventing send with an empty model."""
        composer_file = WORKSPACE_ROOT / "app/static/js/components/composer.js"
        self.assertTrue(composer_file.exists(), f"composer.js missing: {composer_file}")
        with open(composer_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("if (!modelToUse)", content)
        self.assertIn("No model selected", content)

    def test_chat_error_categorization_handles_422(self):
        """Verify that chat.js classifies 422 / unprocessable validation errors."""
        chat_file = WORKSPACE_ROOT / "app/static/js/components/chat.js"
        self.assertTrue(chat_file.exists(), f"chat.js missing: {chat_file}")
        with open(chat_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("invalid_model_request", content)
        self.assertIn("Invalid Model Request", content)

    def test_tts_controller_implements_caching_and_lifecycle(self):
        """Verify that tts.js implements single audio stream, cache map, and stop controls."""
        tts_file = WORKSPACE_ROOT / "app/static/js/tts.js"
        self.assertTrue(tts_file.exists(), f"tts.js missing: {tts_file}")
        with open(tts_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("class TTSController", content)
        self.assertIn("new Audio()", content)
        self.assertIn("this.cache = new Map()", content)
        self.assertIn("this.cache.has(messageId)", content)
        self.assertIn("URL.createObjectURL(blob)", content)
        self.assertIn("stop()", content)
        self.assertIn("this.audio.pause()", content)

    def test_tts_speaker_button_visibility_and_script_filter(self):
        """Verify that rtl.js and chat.js enforce Latin language detection and hide for code-only."""
        rtl_file = WORKSPACE_ROOT / "app/static/js/rtl.js"
        chat_file = WORKSPACE_ROOT / "app/static/js/components/chat.js"

        with open(rtl_file, "r", encoding="utf-8") as f:
            rtl_content = f.read()
        self.assertIn("isPredominantlyEnglish", rtl_content)
        self.assertIn("hasSpeakableContent", rtl_content)

        with open(chat_file, "r", encoding="utf-8") as f:
            chat_content = f.read()
        self.assertIn("isPredominantlyEnglish(msg.content)", chat_content)
        self.assertIn("btn-tts", chat_content)
        self.assertIn("aria-label", chat_content)

    def test_tts_session_switch_lifecycle(self):
        """Verify that app.js stops audio playback when switching or deleting chat sessions."""
        app_file = WORKSPACE_ROOT / "app/static/js/app.js"
        with open(app_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("ttsController.stop()", content)
        self.assertIn("session:active-changed", content)

    def test_tts_css_classes_defined(self):
        """Verify style.css includes classes for TTS button and idle/loading/playing states."""
        css_file = WORKSPACE_ROOT / "app/static/style.css"
        with open(css_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn(".btn-tts", content)
        self.assertIn(".btn-tts.loading", content)
        self.assertIn(".btn-tts.playing", content)


if __name__ == "__main__":
    unittest.main()
