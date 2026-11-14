"""Unit tests for scripts/deploy.sh CLI options and wrappers.

Conforms strictly to Constitution Principle I (Infrastructure Isolation):
All container interactions are offline without mutating real Incus host infrastructure.
"""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEPLOY_SCRIPT = REPO_ROOT / "scripts" / "deploy.sh"
ROOT_DEPLOY_WRAPPER = REPO_ROOT / "deploy.sh"
MOCK_INCUS = REPO_ROOT / "tests" / "unit" / "mock_incus.sh"


class TestDeployScript(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.env = os.environ.copy()
        self.env["INCUS_BIN"] = str(MOCK_INCUS)
        self.env["MOCK_INCUS_STATE_DIR"] = self.tmp_dir.name
        self.env["MOCK_CONTAINER_STATUS"] = "RUNNING"
        self.env["MOCK_SERVICE_STATUS"] = "active"

    def tearDown(self):
        self.tmp_dir.cleanup()

    def run_deploy(self, args=None, input_text=None, env=None, script_path=None):
        target = str(script_path or DEPLOY_SCRIPT)
        cmd = [target] + (args or [])
        return subprocess.run(
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            env=env or self.env,
            cwd=str(REPO_ROOT),
        )

    def test_help_flag(self):
        """Test that -h and --help print modern usage information."""
        for flag in ["-h", "--help"]:
            res = self.run_deploy([flag])
            self.assertEqual(res.returncode, 0)
            out = res.stdout.lower()
            self.assertIn("usage:", out)
            self.assertIn("--install", res.stdout)
            self.assertIn("--update", res.stdout)
            self.assertIn("--status", res.stdout)
            self.assertIn("--version", res.stdout)

    def test_version_flag(self):
        """Test that -v and --version output version information."""
        for flag in ["-v", "--version"]:
            res = self.run_deploy([flag])
            self.assertEqual(res.returncode, 0)
            self.assertIn("e-webui deployment lifecycle manager", res.stdout)

    def test_invalid_container_name(self):
        """Test rejection of illegal container names with special characters."""
        for bad_name in ["invalid/name!", "bad name", "test@app", "box:123"]:
            res = self.run_deploy([bad_name])
            self.assertEqual(res.returncode, 2)
            self.assertIn("Invalid container name", res.stderr)

    def test_unknown_option(self):
        """Test rejection of unknown command line flags."""
        res = self.run_deploy(["--bogus-option"])
        self.assertEqual(res.returncode, 2)
        self.assertIn("Unknown option: --bogus-option", res.stderr)

    def test_update_missing_container(self):
        """Test that --update on a nonexistent container fails with error."""
        self.env["MOCK_CONTAINER_STATUS"] = "NOT_FOUND"
        res = self.run_deploy(["--update", "nonexistent-box"], env=self.env)
        self.assertEqual(res.returncode, 2)
        self.assertIn("does not exist", res.stderr)

    def test_status_nonexistent_container(self):
        """Test that --status on a nonexistent container warns and exits cleanly."""
        self.env["MOCK_CONTAINER_STATUS"] = "NOT_FOUND"
        res = self.run_deploy(["--status", "nonexistent-box"], env=self.env)
        self.assertEqual(res.returncode, 0)
        self.assertIn("does not exist", res.stdout)

    def test_root_deploy_wrapper(self):
        """Test that root wrapper ./deploy.sh delegates correctly to scripts/deploy.sh."""
        res = self.run_deploy(["--version"], script_path=ROOT_DEPLOY_WRAPPER)
        self.assertEqual(res.returncode, 0)
        self.assertIn("e-webui deployment lifecycle manager", res.stdout)

    def test_systemd_service_and_test_runner_python_paths(self):
        """Ensure systemd service and test.sh do not hardcode stale /opt/open-webui paths."""
        service_file = REPO_ROOT / "app" / "systemd" / "e-webui.service"
        self.assertTrue(service_file.exists())
        service_content = service_file.read_text()
        self.assertNotIn("/opt/open-webui", service_content)

        test_runner = REPO_ROOT / "scripts" / "test.sh"
        self.assertTrue(test_runner.exists())
        runner_content = test_runner.read_text()
        self.assertNotIn("/opt/open-webui", runner_content)


if __name__ == "__main__":
    unittest.main()
