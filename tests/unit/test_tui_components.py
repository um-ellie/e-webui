"""Unit tests for terminal UI components and interactive helpers."""

import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestTUIComponents(unittest.TestCase):

    def test_tui_badge_variants(self):
        """Verify that tui_badge formats ANSI colors appropriately for states."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/tui.sh"
        tui_badge "RUNNING" "running"
        printf "\\n"
        tui_badge "STOPPED" "stopped"
        printf "\\n"
        tui_badge "DEGRADED" "degraded"
        printf "\\n"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        output = res.stdout
        self.assertIn("RUNNING", output)
        self.assertIn("STOPPED", output)
        self.assertIn("DEGRADED", output)

    def test_tui_dashboard_renders(self):
        """Verify dashboard rendering with simulated parameters."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/tui.sh"
        tui_render_dashboard "webui" "RUNNING" "active" "200" "ONLINE" "20261120-120000" "1.0.0" "core" "8080" "38.5 MB"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Container:", res.stdout)
        self.assertIn("webui", res.stdout)
        self.assertIn("Host Proxy:", res.stdout)
        self.assertIn("8080", res.stdout)
        self.assertIn("core", res.stdout)
        self.assertIn("38.5 MB", res.stdout)

    def test_tui_menu_options(self):
        """Verify menu renders all expected choices."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/tui.sh"
        tui_render_menu
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Smart Update", res.stdout)
        self.assertIn("Fast Dev-Sync", res.stdout)
        self.assertIn("Service Control", res.stdout)
        self.assertIn("Live Logs", res.stdout)
        self.assertIn("Rollback", res.stdout)
        self.assertIn("Diagnostics & Repair", res.stdout)
        self.assertIn("Modular Profiles", res.stdout)
        self.assertIn("Run Test Suite", res.stdout)


if __name__ == "__main__":
    unittest.main()
