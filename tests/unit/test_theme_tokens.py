"""Unit tests verifying theme token contract compliance in style.css."""

import json
from pathlib import Path
import unittest

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
THEME_CONTRACT = WORKSPACE_ROOT / "specs/021-pastel-ui-overhaul/contracts/theme-tokens.json"
STYLE_CSS = WORKSPACE_ROOT / "app/static/style.css"


class TestThemeTokens(unittest.TestCase):
    """Verifies that style.css implements the required pastel design tokens."""

    def test_theme_tokens_contract_exists(self):
        """Verify theme-tokens contract is present and valid."""
        self.assertTrue(THEME_CONTRACT.exists(), f"Missing theme contract: {THEME_CONTRACT}")
        with open(THEME_CONTRACT, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("tokens", data)
        self.assertIn("themes", data)

    def test_style_css_defines_required_tokens(self):
        """Verify style.css declares all required pastel design tokens."""
        self.assertTrue(STYLE_CSS.exists(), f"style.css missing: {STYLE_CSS}")
        with open(STYLE_CSS, "r", encoding="utf-8") as f:
            css_content = f.read()

        with open(THEME_CONTRACT, "r", encoding="utf-8") as f:
            contract = json.load(f)

        required_tokens = contract.get("tokens", [])
        for token in required_tokens:
            self.assertIn(
                token,
                css_content,
                f"Required theme token '{token}' not defined in style.css"
            )

    def test_wcag_aa_contrast_compliance(self):
        """Verify that primary and secondary text tokens achieve WCAG 2.1 AA contrast."""
        with open(THEME_CONTRACT, "r", encoding="utf-8") as f:
            contract = json.load(f)

        themes = contract.get("themes", {})

        def hex_to_rgb(hex_str):
            h = hex_str.lstrip("#")
            return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

        def relative_luminance(rgb):
            def channel_lum(c):
                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
            r, g, b = (channel_lum(c) for c in rgb)
            return 0.2126 * r + 0.7152 * g + 0.0722 * b

        def contrast_ratio(hex1, hex2):
            l1 = relative_luminance(hex_to_rgb(hex1))
            l2 = relative_luminance(hex_to_rgb(hex2))
            lighter = max(l1, l2)
            darker = min(l1, l2)
            return (lighter + 0.05) / (darker + 0.05)

        for theme_name, tokens in themes.items():
            bg = tokens["--bg"]
            ink = tokens["--ink"]
            mute = tokens["--mute"]

            ink_ratio = contrast_ratio(bg, ink)
            mute_ratio = contrast_ratio(bg, mute)

            # Normal text requires >= 4.5:1
            self.assertGreaterEqual(
                ink_ratio,
                4.5,
                f"{theme_name} theme primary ink {ink} against {bg} has contrast {ink_ratio:.2f} < 4.5"
            )
            self.assertGreaterEqual(
                mute_ratio,
                4.5,
                f"{theme_name} theme mute text {mute} against {bg} has contrast {mute_ratio:.2f} < 4.5"
            )


if __name__ == "__main__":
    unittest.main()
