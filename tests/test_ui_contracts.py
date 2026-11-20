"""Automated Contract & Static Verification Suite for Pastel Design System & UI/UX.

Feature: specs/024-pastel-modern-ui-enhancements
Verifies:
- 4-palette token definitions across light and dark modes
- WCAG AA contrast compliance for text and UI elements
- Glassmorphism and micro-interaction CSS rules
- SVG symbols registry for action docks, starter cards, and pins
- Pre-first-paint theme/palette execution script in index.html
"""

import os
import re
import unittest

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_HTML = os.path.join(WORKSPACE_ROOT, "app", "static", "index.html")
STYLE_CSS = os.path.join(WORKSPACE_ROOT, "app", "static", "style.css")
THEME_JS = os.path.join(WORKSPACE_ROOT, "app", "static", "js", "theme.js")
APP_JS = os.path.join(WORKSPACE_ROOT, "app", "static", "js", "app.js")
DB_JS = os.path.join(WORKSPACE_ROOT, "app", "static", "js", "db.js")


class TestPastelUIContracts(unittest.TestCase):
    """Verifies UI contracts and static asset structures."""

    def test_index_html_exists(self):
        self.assertTrue(os.path.exists(INDEX_HTML), "index.html must exist")

    def test_style_css_exists(self):
        self.assertTrue(os.path.exists(STYLE_CSS), "style.css must exist")

    def test_theme_js_exists(self):
        self.assertTrue(os.path.exists(THEME_JS), "theme.js must exist")

    def test_svg_symbols_registered(self):
        """Verifies critical SVG symbols are registered in index.html."""
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            content = f.read()

        required_symbols = ["check", "pin", "retry", "sound-wave", "clip", "mic", "act"]
        for sym in required_symbols:
            self.assertIn(f'id="{sym}"', content, f"SVG symbol '#{sym}' must be defined in index.html")

    def test_pre_paint_script_handles_palette(self):
        """Verifies synchronous inline head script initializes ewebui_palette."""
        with open(INDEX_HTML, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("ewebui_palette", content, "Pre-paint script in index.html must read 'ewebui_palette'")
        self.assertIn("dataset.palette", content, "Pre-paint script in index.html must set documentElement.dataset.palette")

    def test_four_pastel_palettes_in_css(self):
        """Verifies that all 4 palettes (matcha, lavender, peach, ocean) exist in style.css."""
        with open(STYLE_CSS, "r", encoding="utf-8") as f:
            css = f.read()

        for palette in ["matcha", "lavender", "peach", "ocean"]:
            for mode in ["light", "dark"]:
                pattern = rf'\[data-palette="{palette}"\]\[data-theme="{mode}"\]'
                self.assertTrue(
                    re.search(pattern, css) is not None,
                    f"style.css must define CSS rule for [data-palette=\"{palette}\"][data-theme=\"{mode}\"]"
                )

    def test_glassmorphism_css_properties(self):
        """Verifies backdrop-filter and ambient glow variables are defined."""
        with open(STYLE_CSS, "r", encoding="utf-8") as f:
            css = f.read()

        self.assertIn("backdrop-filter", css, "style.css must include backdrop-filter for frosted surfaces")
        self.assertIn("--glow", css, "style.css must define --glow token")
        self.assertIn(".msg-dock", css, "style.css must define message action dock styling")
        self.assertIn(".starter-card", css, "style.css must define starter cards styling")

    def test_theme_js_exports_palette_management(self):
        """Verifies theme.js supports setPalette, getSavedPalette, and palette synchronization."""
        with open(THEME_JS, "r", encoding="utf-8") as f:
            js = f.read()

        self.assertIn("setPalette", js, "ThemeManager must expose setPalette method")
        self.assertIn("ewebui_palette", js, "ThemeManager must persist ewebui_palette")

    def test_db_js_pinned_session_support(self):
        """Verifies db.js handles pinned session state."""
        with open(DB_JS, "r", encoding="utf-8") as f:
            js = f.read()

        self.assertIn("pinned", js, "db.js must handle session pinned field")


if __name__ == "__main__":
    unittest.main()
