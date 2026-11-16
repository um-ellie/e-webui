"""Automated End-to-End Verification Suite for Modern AI Chat & Ollama Connection UI/UX.

Feature: specs/022-modern-ai-chat-ux
Verifies live container e-webui-app (port 8080) and workspace assets.
"""

import json
import urllib.request
import urllib.error
import unittest

BASE_URL = "http://127.0.0.1:8080"


def fetch(path, method="GET", data=None, headers=None, timeout=20):
    url = f"{BASE_URL}{path}"
    req_headers = headers or {}
    req_data = None
    if data is not None:
        if isinstance(data, (dict, list)):
            req_data = json.dumps(data).encode("utf-8")
            req_headers["Content-Type"] = "application/json"
        elif isinstance(data, bytes):
            req_data = data
        elif isinstance(data, str):
            req_data = data.encode("utf-8")

    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read()
            return resp.status, dict(resp.headers), content
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return 0, {}, str(e).encode("utf-8")


class TestModernAIChatUXE2E(unittest.TestCase):
    """End-to-end verification against running e-webui-app container."""

    def test_01_index_html_structure_and_contracts(self):
        """Verify index.html contains all required elements of the redesign."""
        status, headers, content = fetch("/")
        self.assertEqual(status, 200, f"Failed to fetch /: status={status}")
        html = content.decode("utf-8")

        # 1. Pre-first-paint theme script
        self.assertIn("document.documentElement.dataset.theme", html)
        self.assertIn("localStorage.getItem('ewebui_theme')", html)

        # 2. SVG Symbols
        for symbol in ["#plus", "#mic", "#send", "#stop", "#sun", "#moon", "#mon", "#act", "#gear", "#srch", "#chev", "#bulb", "#sld", "#clip", "#tool", "#pen", "#x", "#ok"]:
            self.assertIn(f'id="{symbol[1:]}"', html, f"Missing SVG symbol: {symbol}")

        # 3. Sidebar Brand & Logo
        self.assertIn("logo-cursor", html)
        self.assertIn("btn-collapse-sidebar", html)

        # 4. Header: 3-State Theme Switcher (NO header status pill)
        self.assertIn('data-seg', html)
        self.assertIn('data-m="light"', html)
        self.assertIn('data-m="dark"', html)
        self.assertIn('data-m="system"', html)
        self.assertNotIn('health-indicator-container', html)
        self.assertNotIn('health-indicator-btn', html)

        # 5. Authoritative Sidebar Footer Telemetry Capsule & Upward Popover
        self.assertIn('id="conn"', html)
        self.assertIn('id="cpop"', html)
        self.assertIn('id="cstate"', html)
        self.assertIn('id="cend"', html)
        self.assertIn('id="clat"', html)
        self.assertIn('id="cmodels"', html)
        self.assertIn('id="retest"', html)

        # 6. Reading column & start-aligned empty greeting
        self.assertIn('id="view"', html)
        self.assertIn('id="empty-greeting"', html)
        self.assertIn('id="messages-list"', html)

        # 7. Contextual Clean Capsule Composer
        self.assertIn('id="chips"', html)
        self.assertIn('id="ta"', html)
        self.assertIn('id="mic"', html)
        self.assertIn('id="plus"', html)
        self.assertIn('id="ppop"', html)
        self.assertIn('id="thinkbtn"', html)
        self.assertIn('id="mc"', html)
        self.assertIn('id="mpop"', html)
        self.assertIn('id="go"', html)

        # 8. 3-Pane Task-Centric Settings Modal
        self.assertIn('id="ov"', html)
        self.assertIn('data-pane="p1"', html)
        self.assertIn('data-pane="p2"', html)
        self.assertIn('data-pane="p3"', html)
        self.assertIn('id="p1"', html)
        self.assertIn('id="p2"', html)
        self.assertIn('id="p3"', html)
        self.assertIn('id="fsr"', html)
        self.assertIn('id="sc"', html)
        self.assertIn('id="tr"', html)
        self.assertIn('id="pr"', html)
        self.assertIn('id="ta-sys"', html)
        self.assertIn('id="del"', html)

    def test_02_style_css_palette_tokens(self):
        """Verify style.css includes Soft Sage & Warm Sand palette and responsive rules."""
        status, headers, content = fetch("/static/style.css")
        self.assertEqual(status, 200)
        css = content.decode("utf-8")

        # Root tokens
        self.assertIn("--bg: #fff9ef;", css)
        self.assertIn("--panel: #fffefb;", css)
        self.assertIn("--side: #fdeedb;", css)
        self.assertIn("--line: #f1dfc5;", css)
        self.assertIn("--tx: #2c3a33;", css)
        self.assertIn("--sage: #5fc79b;", css)
        self.assertIn("--sd: #1b7552;", css)
        self.assertIn("--tint: #d6f3e4;", css)
        self.assertIn("--peach: #ffe2cc;", css)
        self.assertIn("--rose: #ff7f9c;", css)
        self.assertIn("--danger: #d2354f;", css)
        self.assertIn("--btn: #25996d;", css)

        # Dark theme
        self.assertIn('[data-theme="dark"]', css)
        self.assertIn("--bg: #1a2420;", css)
        self.assertIn("--panel: #243029;", css)

        # Ambient glow & sliding thumb
        self.assertIn("radial-gradient(560px 380px", css)
        self.assertIn(".seg::before", css)
        self.assertIn("calc(var(--i, 0) * 32px)", css)

        # Capsule and popover
        self.assertIn(".st-on .dot", css)
        self.assertIn(".st-slow .dot", css)
        self.assertIn(".st-off .dot", css)
        self.assertIn(".st-chk .dot", css)
        self.assertIn(".pop.up", css)

        # Settings
        self.assertIn(".btn2.sure", css)
        self.assertIn(".dz", css)

        # Responsive layout
        self.assertIn("@media (max-width: 760px)", css)

    def test_03_api_health_endpoint(self):
        """Verify /api/health returns valid schema and connected status."""
        status, headers, content = fetch("/api/health")
        self.assertEqual(status, 200)
        data = json.loads(content.decode("utf-8"))
        self.assertIn("status", data)
        self.assertIn("ollama_connected", data)
        self.assertTrue(data["ollama_connected"])
        self.assertIn("loaded_models", data)
        self.assertIsInstance(data["loaded_models"], list)

    def test_04_api_models_endpoint(self):
        """Verify /api/models returns available models."""
        status, headers, content = fetch("/api/models")
        self.assertEqual(status, 200)
        data = json.loads(content.decode("utf-8"))
        self.assertIn("models", data)
        self.assertGreaterEqual(len(data["models"]), 1)
        model_names = [m["name"] for m in data["models"]]
        self.assertTrue(any("qwen" in m or "gemma" in m for m in model_names))

    def test_05_api_generate_streaming_sse(self):
        """Verify /api/generate SSE stream returns live chunks."""
        req_data = json.dumps({
            "model": "qwen3.5:4b",
            "prompt": "Hi",
            "stream": True
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/api/generate",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            self.assertEqual(resp.status, 200)
            # Read first few lines of the SSE stream
            collected_chunks = []
            for _ in range(10):
                line = resp.readline().decode("utf-8").strip()
                if line.startswith("data: "):
                    chunk = json.loads(line[6:])
                    collected_chunks.append(chunk)
                    if len(collected_chunks) >= 3:
                        break

            self.assertGreaterEqual(len(collected_chunks), 1, "Expected at least 1 streaming SSE chunk")
            first_chunk = collected_chunks[0]
            self.assertIn("status", first_chunk)
            self.assertEqual(first_chunk["status"], "streaming")

    def test_06_javascript_modules_accessible(self):
        """Verify all static JavaScript modules are served correctly without 404."""
        modules = [
            "/static/js/app.js",
            "/static/js/store.js",
            "/static/js/health.js",
            "/static/js/theme.js",
            "/static/js/api.js",
            "/static/js/db.js",
            "/static/js/features.js",
            "/static/js/shortcuts.js",
            "/static/js/tts.js",
            "/static/js/components/header.js",
            "/static/js/components/sidebar.js",
            "/static/js/components/composer.js",
            "/static/js/components/settings.js",
            "/static/js/components/empty.js",
            "/static/js/components/chat.js"
        ]
        for mod in modules:
            status, _, _ = fetch(mod)
            self.assertEqual(status, 200, f"Module failed to load: {mod} (status={status})")


if __name__ == "__main__":
    unittest.main()
