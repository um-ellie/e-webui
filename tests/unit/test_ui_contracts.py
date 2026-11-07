"""Unit tests verifying UI feature registry contracts and constraints."""

import json
from pathlib import Path
import unittest

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
CONTRACT_FILE = WORKSPACE_ROOT / "specs/012-chat-ui-redesign/contracts/ui-features.json"
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
        self.assertEqual(default_controls["session.new"]["status"], "enabled")

        # Check key future controls have disabled status and reason
        future_controls = ["chat.attach_file", "chat.tools_menu", "chat.export", "session.pin", "nav.library"]
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


if __name__ == "__main__":
    unittest.main()
