"""Unit tests for scripts/deploy.sh using mocked Incus executable.

Conforms strictly to Constitution Principle I (Infrastructure Isolation):
All container interactions are mocked using a local test fixture script
without invoking real Incus commands or communicating with live containers.
"""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEPLOY_SCRIPT = REPO_ROOT / "scripts" / "deploy.sh"
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

    def run_deploy(self, args=None, input_text=None, env=None):
        cmd = [str(DEPLOY_SCRIPT)] + (args or [])
        return subprocess.run(
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            env=env or self.env,
            cwd=str(REPO_ROOT),
        )

    def test_help_flag(self):
        """Test that -h and --help print usage information."""
        res = self.run_deploy(["--help"])
        self.assertEqual(res.returncode, 0)
        out = res.stdout.lower()
        self.assertTrue("usage:" in out or "usage" in out)
        self.assertTrue("--yes" in res.stdout or "-y" in res.stdout)
        self.assertTrue("--reset" in res.stdout or "-r" in res.stdout)

    def test_invalid_container_name(self):
        """Test rejection of illegal container names with special characters."""
        res = self.run_deploy(["invalid/name!"])
        self.assertEqual(res.returncode, 2)
        self.assertIn("Invalid container name", res.stderr)

    def test_container_not_found(self):
        """Test error when container is not found in incus."""
        self.env["MOCK_CONTAINER_STATUS"] = "NOT_FOUND"
        res = self.run_deploy(["webui"], env=self.env)
        self.assertEqual(res.returncode, 2)
        self.assertIn("not found in Incus", res.stderr)

    def test_non_interactive_full_deployment(self):
        """Test full deployment run with -y / --yes flag."""
        res = self.run_deploy(["-y", "webui"])
        self.assertEqual(res.returncode, 0)
        self.assertIn("Deploying e-webui to Incus Container: webui", res.stdout)
        self.assertIn("Step 1 complete.", res.stdout)
        self.assertIn("Step 2 complete.", res.stdout)
        self.assertIn("Step 3 complete.", res.stdout)
        self.assertIn("Step 4 complete.", res.stdout)
        self.assertIn("Deployment Successfully Completed!", res.stdout)
        self.assertIn("http://127.0.0.1:8080", res.stdout)

        # Verify proxy devices were configured
        devices_file = Path(self.tmp_dir.name) / "devices_webui.conf"
        self.assertTrue(devices_file.exists())
        devices_content = devices_file.read_text()
        self.assertIn("webui-proxy:", devices_content)
        self.assertIn("ollama-link:", devices_content)

        # Verify state file was created
        state_file = Path(self.tmp_dir.name) / "opt" / "e-webui" / ".deploy_state"
        self.assertTrue(state_file.exists())
        content = state_file.read_text()
        self.assertIn("STEP_1_CONTAINER_VERIFIED", content)
        self.assertIn("STEP_5_HEALTH_VERIFIED", content)

    def test_interactive_container_prompt(self):
        """Test prompting for container name and confirming each step."""
        # Input: container name "mybox", then 'y' for each of the 5 steps
        user_input = "mybox\ny\ny\ny\ny\ny\n"
        res = self.run_deploy(input_text=user_input)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Deploying e-webui to Incus Container: mybox", res.stdout)
        self.assertIn("Deployment Successfully Completed!", res.stdout)

    def test_resumability_skips_completed_steps(self):
        """Test that re-running skips already completed steps."""
        # 1. Complete deployment
        res1 = self.run_deploy(["-y", "webui"])
        self.assertEqual(res1.returncode, 0)

        # 2. Run again without reset -> Should report all completed
        res2 = self.run_deploy(["-y", "webui"])
        self.assertEqual(res2.returncode, 0)
        self.assertIn("All deployment steps have already been successfully completed", res2.stdout)

    def test_force_reset_clears_state(self):
        """Test that --reset forces re-running all steps."""
        # 1. First run
        res1 = self.run_deploy(["-y", "webui"])
        self.assertEqual(res1.returncode, 0)

        # 2. Run with --reset
        res2 = self.run_deploy(["--reset", "-y", "webui"])
        self.assertEqual(res2.returncode, 0)
        self.assertIn("Force reset requested", res2.stdout)
        self.assertIn("Step 1 complete.", res2.stdout)

    def test_user_rejection_and_abort(self):
        """Test declining a step and confirming abort."""
        # Input: webui container name, step 1 confirm 'y', step 2 decline 'n', confirm abort 'y'
        user_input = "webui\ny\nn\ny\n"
        res = self.run_deploy(input_text=user_input)
        self.assertEqual(res.returncode, 1)
        self.assertIn("Skipping this step", res.stdout)
        self.assertIn("Deployment aborted by user at Step 2", res.stderr)

        # Check state: step 1 is recorded, but step 2 is not
        state_file = Path(self.tmp_dir.name) / "opt" / "e-webui" / ".deploy_state"
        self.assertTrue(state_file.exists())
        content = state_file.read_text()
        self.assertIn("STEP_1_CONTAINER_VERIFIED", content)
        self.assertNotIn("STEP_2_PREREQUISITES_INSTALLED", content)

    def test_user_rejection_reconsideration(self):
        """Test declining a step, choosing not to abort ('n'), and then proceeding ('y')."""
        # Input: container 'webui', step 1 'y', step 2 decline 'n', abort choice 'n' (reconsider), then 'y' for steps 2..5
        user_input = "webui\ny\nn\nn\ny\ny\ny\ny\n"
        res = self.run_deploy(input_text=user_input)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Reconsidering step...", res.stdout)
        self.assertIn("Deployment Successfully Completed!", res.stdout)

    def test_systemd_service_and_test_runner_python_paths(self):
        """Ensure systemd service and test.sh do not hardcode stale /opt/open-webui paths."""
        service_file = REPO_ROOT / "app" / "systemd" / "e-webui.service"
        self.assertTrue(service_file.exists())
        service_content = service_file.read_text()
        self.assertNotIn("/opt/open-webui", service_content)
        self.assertIn("ExecStart=/usr/bin/python3 -m uvicorn", service_content)

        test_runner = REPO_ROOT / "scripts" / "test.sh"
        self.assertTrue(test_runner.exists())
        runner_content = test_runner.read_text()
        self.assertNotIn("/opt/open-webui", runner_content)
        self.assertIn('PYTHON_BIN="/usr/bin/python3"', runner_content)


if __name__ == "__main__":
    unittest.main()
