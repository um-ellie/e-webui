"""Unit tests for smart update change detection and auto-packaging."""

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestSmartUpdate(unittest.TestCase):

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.app_dir = self.temp_dir / "app"
        self.app_dir.mkdir()
        (self.app_dir / "main.py").write_text('app = FastAPI(title="e-webui", version="1.0.0")\n')
        (self.temp_dir / "requirements.txt").write_text("fastapi>=0.100.0\n")
        self.dist_dir = self.temp_dir / "dist" / "releases"
        self.dist_dir.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_workspace_has_changes_when_no_releases(self):
        """When dist/releases is empty, workspace_has_changes should return 0 (true)."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/builder.sh"
        workspace_has_changes "{self.temp_dir}" "{self.dist_dir}"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)

    def test_auto_package_creates_bundle(self):
        """auto_package_if_needed creates a release package when none exists."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/archive.sh"
        source "{REPO_ROOT}/scripts/lib/builder.sh"
        pkg=$(auto_package_if_needed "{self.temp_dir}" "{self.dist_dir}")
        echo "CREATED_PKG:$pkg"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("CREATED_PKG:", res.stdout)
        # Check that file was created in dist_dir
        bundles = list(self.dist_dir.glob("*.tar.gz")) + [d for d in self.dist_dir.iterdir() if d.is_dir()]
        self.assertTrue(len(bundles) > 0)


if __name__ == "__main__":
    unittest.main()
