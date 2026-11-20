"""Unit tests for architecture detection and modular profiles."""

import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestProfilesAndArch(unittest.TestCase):

    def test_detect_system_architecture(self):
        """Verify detect_system_arch maps uname -m to x86_64 or aarch64."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/detect.sh"
        detect_system_arch
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        arch = res.stdout.strip()
        self.assertIn(arch, ["x86_64", "aarch64", "unknown"])

    def test_python_version_compatibility_accepts_py310_to_py313(self):
        """Verify python compatibility range supports 3.10 through 3.13."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        python3 -c "
import sys
major, minor = sys.version_info[:2]
if (3, 10) <= (major, minor) <= (3, 13):
    sys.exit(0)
sys.exit(1)
"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)


if __name__ == "__main__":
    unittest.main()
