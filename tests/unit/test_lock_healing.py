"""Unit tests for deployment lock acquisition, lease expiration, and self-healing."""

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from tests.mock_incus import MockIncusState, create_mock_cli_script

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestLockHealing(unittest.TestCase):

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.state_dir = self.temp_dir / "mock_state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.mock_cli = create_mock_cli_script(self.state_dir)
        self.mock_state = MockIncusState(self.state_dir)
        self.mock_state.add_container("webui", status="RUNNING")

        self.env = {
            "INCUS_BIN": str(self.mock_cli),
            "MOCK_INCUS_STATE_DIR": str(self.state_dir),
            "PATH": "/usr/bin:/bin",
            "NON_INTERACTIVE": "1",
            "FORCE_RESET": "0",
        }

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_acquire_and_release_lock(self):
        """Verify normal lock acquisition and release."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/incus.sh"
        source "{REPO_ROOT}/scripts/lib/lock.sh"
        acquire_lock "webui" "/opt/e-webui"
        release_lock "webui" "/opt/e-webui"
        """
        res = subprocess.run(["bash", "-c", script], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)

    def test_stale_lock_auto_heals_with_force_reset(self):
        """Verify that FORCE_RESET=1 automatically clears a preexisting lock."""
        c_root = self.mock_state.containers_dir / "webui"
        lock_dir = c_root / "opt" / "e-webui" / ".deploy.lock"
        lock_dir.mkdir(parents=True)
        (lock_dir / "info").write_text("pid=999999;time=2020-01-01T00:00:00Z;user=test\n")

        env_reset = self.env.copy()
        env_reset["FORCE_RESET"] = "1"

        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/incus.sh"
        source "{REPO_ROOT}/scripts/lib/lock.sh"
        acquire_lock "webui" "/opt/e-webui"
        """
        res = subprocess.run(["bash", "-c", script], env=env_reset, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Cleared stale or overridden lock", res.stdout + res.stderr)


if __name__ == "__main__":
    unittest.main()
