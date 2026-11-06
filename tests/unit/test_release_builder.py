"""Unit tests for scripts/build-release.sh and scripts/lib/builder.sh.

Complies strictly with Constitution Principle I (Infrastructure Isolation):
Executes completely within workspace without touching live containers or Incus APIs.
"""

import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-release.sh"


class TestReleaseBuilder(unittest.TestCase):

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.out_dir = self.temp_dir / "dist" / "releases"
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _run_builder(self, *args, cwd=None):
        cmd = [str(BUILD_SCRIPT), "--output-dir", str(self.out_dir)] + list(args)
        return subprocess.run(
            cmd,
            cwd=str(cwd or REPO_ROOT),
            capture_output=True,
            text=True,
        )

    def test_build_release_success(self):
        """Verify build-release.sh produces both uncompressed directory and .tar.gz bundle."""
        res = self._run_builder("--version", "1.0.0")
        self.assertEqual(res.returncode, 0, f"Builder failed: {res.stderr}\nStdout: {res.stdout}")

        # Verify output directory has a release directory and a tarball
        entries = list(self.out_dir.iterdir())
        self.assertTrue(any(e.is_dir() for e in entries), "No release directory found")
        self.assertTrue(any(e.is_file() and e.name.endswith(".tar.gz") for e in entries), "No release tarball found")

        rel_dir = next(e for e in entries if e.is_dir())
        self.assertTrue((rel_dir / "manifest.json").exists())
        self.assertTrue((rel_dir / "checksums.sha256").exists())
        self.assertTrue((rel_dir / "payload" / "app.tar.gz").exists())
        self.assertTrue((rel_dir / "payload" / "requirements.txt").exists())
        self.assertTrue((rel_dir / "payload" / "systemd" / "e-webui.service").exists())

    def test_strict_exclusions(self):
        """Verify that payload/app.tar.gz contains only app files and strictly excludes secrets/dev files."""
        res = self._run_builder("--version", "1.0.0")
        self.assertEqual(res.returncode, 0)

        rel_dir = next(e for e in self.out_dir.iterdir() if e.is_dir())
        app_tar = rel_dir / "payload" / "app.tar.gz"

        with tarfile.open(app_tar, "r:gz") as tar:
            names = tar.getnames()
            self.assertTrue(any(n == "app/main.py" or n.endswith("app/main.py") for n in names))
            self.assertTrue(any("static" in n for n in names))
            self.assertFalse(any(".git" in n for n in names))
            self.assertFalse(any(".env" in n for n in names))
            self.assertFalse(any("venv" in n for n in names))
            self.assertFalse(any("tests" in n for n in names))
            self.assertFalse(any("__pycache__" in n for n in names))
            self.assertFalse(any(".pytest_cache" in n for n in names))
            self.assertFalse(any("specs" in n for n in names))

    def test_manifest_and_checksum_integrity(self):
        """Verify that generated release passes manifest validation and checksums."""
        res = self._run_builder("--version", "1.0.0")
        self.assertEqual(res.returncode, 0)

        rel_dir = next(e for e in self.out_dir.iterdir() if e.is_dir())
        manifest_tool = REPO_ROOT / "scripts" / "lib" / "manifest_tool.py"

        val_res = subprocess.run(
            ["python3", str(manifest_tool), "validate-manifest", str(rel_dir / "manifest.json")],
            capture_output=True,
            text=True,
        )
        self.assertEqual(val_res.returncode, 0, f"Manifest invalid: {val_res.stderr}")

        chk_res = subprocess.run(
            ["python3", str(manifest_tool), "verify-checksums", str(rel_dir / "checksums.sha256")],
            capture_output=True,
            text=True,
        )
        self.assertEqual(chk_res.returncode, 0, f"Checksums mismatch: {chk_res.stderr}")


if __name__ == "__main__":
    unittest.main()
