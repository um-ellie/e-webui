"""Unit tests for host vs container port decoupling."""

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from tests.mock_incus import MockIncusState, create_mock_cli_script

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class TestPortDecoupling(unittest.TestCase):

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
        }

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_service_unit_uvicorn_binds_to_8080_regardless_of_host_port(self):
        """Verify render_service_unit generates ExecStart with container port 8080 even if host port is 9090."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/service.sh"
        render_service_unit "/opt/e-webui" "9090" "http://127.0.0.1:11434"
        """
        res = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        content = res.stdout
        self.assertIn('--port 8080', content)
        self.assertIn('Environment="APP_PORT=8080"', content)

    def test_proxy_device_maps_custom_host_port_to_8080(self):
        """Verify configure_proxy_devices maps custom host port to container 8080."""
        script = f"""
        source "{REPO_ROOT}/scripts/lib/common.sh"
        source "{REPO_ROOT}/scripts/lib/incus.sh"
        source "{REPO_ROOT}/scripts/lib/provision.sh"
        configure_proxy_devices "webui" "9090" "127.0.0.1:11434"
        """
        res = subprocess.run(["bash", "-c", script], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        # Check mock calls to ensure proxy device add was called with listen=tcp:127.0.0.1:9090 connect=tcp:127.0.0.1:8080
        calls = self.mock_state.get_calls()
        proxy_add_calls = [
            c for c in calls if len(c) > 4 and c[0] == "config" and c[1] == "device" and (c[2] == "add" or c[2] == "set")
        ]
        self.assertTrue(len(proxy_add_calls) > 0)
        call_str = " ".join(proxy_add_calls[-1])
        self.assertIn("9090", call_str)
        self.assertIn("8080", call_str)


if __name__ == "__main__":
    unittest.main()
