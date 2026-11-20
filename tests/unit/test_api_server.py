"""Unit tests verifying FastAPI endpoints, security headers, and Cache-Control directives."""

import os
import unittest

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "app", "main.py")


class TestApiServer(unittest.TestCase):
    """Verifies API endpoints, security middleware, and cache control statically."""

    def setUp(self):
        with open(MAIN_PY, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_root_index_cache_control(self):
        """Root index must return Cache-Control: no-cache, must-revalidate to prevent stale UI."""
        self.assertIn('"Cache-Control": "no-cache, must-revalidate"', self.content,
                      "serve_index must return Cache-Control: no-cache, must-revalidate")

    def test_static_asset_cache_control(self):
        """Static assets (/static/...) must return Cache-Control: no-cache, must-revalidate."""
        self.assertIn('response.headers["Cache-Control"] = "no-cache, must-revalidate"', self.content,
                      "Middleware must attach Cache-Control: no-cache, must-revalidate to static responses")

    def test_security_headers_present(self):
        """Security headers must be attached to responses."""
        self.assertIn('response.headers["X-Content-Type-Options"] = "nosniff"', self.content)
        self.assertIn('response.headers["X-Frame-Options"] = "DENY"', self.content)
        self.assertIn("Content-Security-Policy", self.content)


if __name__ == "__main__":
    unittest.main()
