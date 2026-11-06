"""Unit tests for scripts/lib/manifest_tool.py.

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
MANIFEST_TOOL = REPO_ROOT / "scripts" / "lib" / "manifest_tool.py"


class TestManifestTool(unittest.TestCase):

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _run_tool(self, *args):
        cmd = ["python3", str(MANIFEST_TOOL)] + list(args)
        return subprocess.run(
            cmd,
            cwd=str(self.temp_dir),
            capture_output=True,
            text=True,
        )

    def _create_sample_release(self, tampered=False):
        """Creates a sample release directory structure."""
        rel_dir = self.temp_dir / "sample_release"
        payload_dir = rel_dir / "payload"
        payload_dir.mkdir(parents=True, exist_ok=True)

        app_tar = payload_dir / "app.tar.gz"
        with tarfile.open(app_tar, "w:gz") as tar:
            info = tarfile.TarInfo(name="app/main.py")
            content = b"# sample app\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        req_txt = payload_dir / "requirements.txt"
        req_txt.write_text("fastapi>=0.100.0\n")

        systemd_dir = payload_dir / "systemd"
        systemd_dir.mkdir(exist_ok=True)
        service_file = systemd_dir / "e-webui.service"
        service_file.write_text("[Unit]\nDescription=e-webui\n")

        def sha256_file(p):
            h = hashlib.sha256()
            h.update(p.read_bytes())
            return h.hexdigest()

        manifest_data = {
            "schema_version": "1.0.0",
            "application": "e-webui",
            "version": "1.0.0",
            "release_id": "20261106-213000-a1b2c3d4",
            "created_at": "2026-11-06T21:30:00Z",
            "git": {
                "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
                "branch": "main",
                "dirty": False,
            },
            "compatibility": {
                "min_deployment_manager_version": "1.0.0",
                "python_version": ">=3.11",
                "target_os": "debian-12",
            },
            "artifacts": [
                {
                    "name": "app.tar.gz",
                    "path": "payload/app.tar.gz",
                    "sha256": sha256_file(app_tar),
                    "size_bytes": app_tar.stat().st_size,
                    "purpose": "app_source",
                },
                {
                    "name": "requirements.txt",
                    "path": "payload/requirements.txt",
                    "sha256": sha256_file(req_txt),
                    "size_bytes": req_txt.stat().st_size,
                    "purpose": "dependencies",
                },
                {
                    "name": "e-webui.service",
                    "path": "payload/systemd/e-webui.service",
                    "sha256": sha256_file(service_file),
                    "size_bytes": service_file.stat().st_size,
                    "purpose": "service_unit",
                },
            ],
            "metadata": {
                "builder": "test-builder/1.0",
            },
        }

        manifest_file = rel_dir / "manifest.json"
        manifest_file.write_text(json.dumps(manifest_data, indent=2))

        checksums_lines = [
            f"{sha256_file(app_tar)}  payload/app.tar.gz",
            f"{sha256_file(req_txt)}  payload/requirements.txt",
            f"{sha256_file(service_file)}  payload/systemd/e-webui.service",
            f"{sha256_file(manifest_file)}  manifest.json",
        ]
        checksums_file = rel_dir / "checksums.sha256"
        checksums_file.write_text("\n".join(checksums_lines) + "\n")

        if tampered:
            req_txt.write_text("fastapi>=0.100.0\n# tampered\n")

        return rel_dir

    def test_validate_valid_manifest(self):
        rel_dir = self._create_sample_release(tampered=False)
        res = self._run_tool("validate-manifest", str(rel_dir / "manifest.json"))
        self.assertEqual(res.returncode, 0, f"Error: {res.stderr}")
        self.assertIn("VALID", res.stdout)

    def test_validate_tampered_manifest_fails(self):
        rel_dir = self._create_sample_release(tampered=True)
        res = self._run_tool("validate-manifest", str(rel_dir / "manifest.json"))
        self.assertNotEqual(res.returncode, 0)

    def test_validate_incompatible_schema_fails(self):
        rel_dir = self._create_sample_release(tampered=False)
        m_path = rel_dir / "manifest.json"
        data = json.loads(m_path.read_text())
        data["schema_version"] = "2.0.0"
        m_path.write_text(json.dumps(data))

        res = self._run_tool("validate-manifest", str(m_path))
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("schema", res.stderr.lower())

    def test_verify_checksums_pass(self):
        rel_dir = self._create_sample_release(tampered=False)
        res = self._run_tool("verify-checksums", str(rel_dir / "checksums.sha256"))
        self.assertEqual(res.returncode, 0, f"Error: {res.stderr}")

    def test_verify_checksums_fail_on_tamper(self):
        rel_dir = self._create_sample_release(tampered=True)
        res = self._run_tool("verify-checksums", str(rel_dir / "checksums.sha256"))
        self.assertNotEqual(res.returncode, 0)

    def test_verify_archive_clean(self):
        archive_path = self.temp_dir / "safe.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            info = tarfile.TarInfo(name="app/main.py")
            content = b"# clean code\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        res = self._run_tool("verify-archive", str(archive_path))
        self.assertEqual(res.returncode, 0, f"Error: {res.stderr}")

    def test_verify_archive_rejects_path_traversal(self):
        archive_path = self.temp_dir / "unsafe_traversal.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            info = tarfile.TarInfo(name="app/../../etc/passwd")
            content = b"root:x:0:0\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        res = self._run_tool("verify-archive", str(archive_path))
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("traversal", res.stderr.lower() + res.stdout.lower())

    def test_verify_archive_rejects_absolute_path(self):
        archive_path = self.temp_dir / "unsafe_absolute.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            info = tarfile.TarInfo(name="/etc/shadow")
            content = b"secret\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        res = self._run_tool("verify-archive", str(archive_path))
        self.assertNotEqual(res.returncode, 0)

    def test_verify_archive_quiet_flag(self):
        archive_path = self.temp_dir / "safe.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            info = tarfile.TarInfo(name="app/main.py")
            content = b"print('safe')\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        # Without --quiet: prints [VALID]
        res_normal = self._run_tool("verify-archive", str(archive_path))
        self.assertEqual(res_normal.returncode, 0)
        self.assertIn("[VALID]", res_normal.stdout)

        # With --quiet: no output on stdout
        res_quiet = self._run_tool("verify-archive", "-q", str(archive_path))
        self.assertEqual(res_quiet.returncode, 0)
        self.assertEqual(res_quiet.stdout.strip(), "")

    def test_create_manifest(self):
        staging = self.temp_dir / "staging"
        payload = staging / "payload"
        payload.mkdir(parents=True)
        (payload / "app.tar.gz").write_bytes(b"dummy app tar")
        (payload / "requirements.txt").write_text("fastapi\n")
        (payload / "systemd").mkdir()
        (payload / "systemd" / "e-webui.service").write_text("[Unit]\n")

        res = self._run_tool(
            "create-manifest",
            "--release-dir", str(staging),
            "--version", "1.2.3",
            "--release-id", "20261106-213000-12345678",
            "--git-commit", "1234567890abcdef1234567890abcdef12345678",
            "--git-branch", "main",
        )
        self.assertEqual(res.returncode, 0, f"Error: {res.stderr}")
        self.assertTrue((staging / "manifest.json").exists())
        self.assertTrue((staging / "checksums.sha256").exists())

        # Validate newly created manifest
        val_res = self._run_tool("validate-manifest", str(staging / "manifest.json"))
        self.assertEqual(val_res.returncode, 0, f"Error: {val_res.stderr}")


if __name__ == "__main__":
    unittest.main()
