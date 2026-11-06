"""Unit and integration tests for e-webui deployment lifecycle manager.

Complies strictly with Constitution Principle I (Infrastructure Isolation):
Tests execute locally inside the workspace repository without accessing live containers.
Runs seamlessly with either standard `unittest` or `pytest`.
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

from tests.mock_incus import MockIncusState, create_mock_cli_script

REPO_ROOT = Path(__file__).resolve().parent.parent


class TestDeployLifecycle(unittest.TestCase):

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.state_dir = self.temp_dir / "mock_state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.mock_cli = create_mock_cli_script(self.state_dir)
        self.mock_state = MockIncusState(self.state_dir)
        self.mock_state.add_container("e-webui-app", status="RUNNING")

        self.env = os.environ.copy()
        self.env["INCUS_BIN"] = str(self.mock_cli)
        self.env["MOCK_INCUS_STATE_DIR"] = str(self.state_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_archive_excludes_secrets_and_vcs(self):
        """Verify that release archiver strictly excludes .git, .env, venvs, and cache."""
        archive_lib = REPO_ROOT / "scripts" / "lib" / "archive.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        src_dir = self.temp_dir / "src"
        src_dir.mkdir()
        (src_dir / "app").mkdir()
        (src_dir / "app" / "main.py").write_text("# app code")
        (src_dir / "requirements.txt").write_text("fastapi>=0.100.0\n")

        # Excluded files
        (src_dir / ".git").mkdir()
        (src_dir / ".git" / "config").write_text("git config")
        (src_dir / ".env").write_text("SECRET=123")
        (src_dir / ".env.local").write_text("SECRET=456")
        (src_dir / "venv").mkdir()
        (src_dir / "venv" / "bin").mkdir()
        (src_dir / "venv" / "bin" / "python").write_text("dummy")
        (src_dir / "specs").mkdir()
        (src_dir / "specs" / "spec.md").write_text("spec")

        dest_tar = self.temp_dir / "release.tar.gz"

        cmd = f"""
        source "{common_lib}"
        source "{archive_lib}"
        build_release_archive "{src_dir}" "{dest_tar}"
        """
        res = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Archive command failed: {res.stderr}")
        self.assertTrue(dest_tar.exists())

        with tarfile.open(dest_tar, "r:gz") as tar:
            names = tar.getnames()
            self.assertTrue(any(n.endswith("app/main.py") or n == "app/main.py" for n in names))
            self.assertTrue(any(n.endswith("requirements.txt") or n == "requirements.txt" for n in names))
            self.assertFalse(any(".git" in n for n in names))
            self.assertFalse(any(".env" in n for n in names))
            self.assertFalse(any("venv" in n for n in names))
            self.assertFalse(any("specs" in n for n in names))

    def test_archive_checksum_calculation(self):
        """Verify SHA-256 checksum computation matches expected hash."""
        archive_lib = REPO_ROOT / "scripts" / "lib" / "archive.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        dummy_file = self.temp_dir / "test.tar.gz"
        dummy_file.write_text("dummy archive content")
        expected_hash = hashlib.sha256(b"dummy archive content").hexdigest()

        cmd = f"""
        source "{common_lib}"
        source "{archive_lib}"
        calculate_checksum "{dummy_file}"
        """
        res = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.strip(), expected_hash)

    def test_requirements_hash_and_venv_resolution(self):
        """Verify requirements.txt hash computation is reproducible."""
        venv_lib = REPO_ROOT / "scripts" / "lib" / "venv.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        req_file = self.temp_dir / "requirements.txt"
        req_file.write_text("fastapi==0.100.0\nuvicorn==0.23.0\n")
        expected_hash = hashlib.sha256(b"fastapi==0.100.0\nuvicorn==0.23.0\n").hexdigest()

        cmd = f"""
        source "{common_lib}"
        source "{venv_lib}"
        calculate_requirements_hash "{req_file}"
        """
        res = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.strip(), expected_hash)

    def test_atomic_symlink_switch(self):
        """Verify atomic pointer replacement points to new release."""
        release_lib = REPO_ROOT / "scripts" / "lib" / "release.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        app_dir = self.temp_dir / "opt" / "e-webui"
        releases_dir = app_dir / "releases"
        releases_dir.mkdir(parents=True)

        rel_1 = releases_dir / "20261106-100000"
        rel_2 = releases_dir / "20261106-200000"
        rel_1.mkdir()
        rel_2.mkdir()
        (rel_1 / "version.txt").write_text("1")
        (rel_2 / "version.txt").write_text("2")

        current_symlink = app_dir / "current"
        os.symlink(rel_1, current_symlink)
        self.assertEqual((current_symlink / "version.txt").read_text(), "1")

        cmd = f"""
        source "{common_lib}"
        source "{release_lib}"
        atomic_switch_release_local "{app_dir}" "20261106-200000"
        """
        res = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual((current_symlink / "version.txt").read_text(), "2")

    def test_cli_help(self):
        """Verify deploy.sh --help outputs all operations and exit codes."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        res = subprocess.run(["bash", str(deploy_sh), "--help"], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("--install", res.stdout)
        self.assertIn("--update", res.stdout)
        self.assertIn("--rollback", res.stdout)
        self.assertIn("--status", res.stdout)
        self.assertIn("--repair", res.stdout)
        self.assertIn("--uninstall", res.stdout)
        self.assertIn("Exit Codes:", res.stdout)

    def test_environment_detection_states(self):
        """Verify detect_deployment_state identifies NOT_FOUND, UNMANAGED, and MANAGED."""
        detect_lib = REPO_ROOT / "scripts" / "lib" / "detect.sh"
        incus_lib = REPO_ROOT / "scripts" / "lib" / "incus.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        # 1. Container does not exist
        cmd = f"""
        source "{common_lib}"
        source "{incus_lib}"
        source "{detect_lib}"
        detect_deployment_state "non-existent-container" "/opt/e-webui"
        """
        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.strip(), "NOT_FOUND")

        # 2. Existing container but no /opt/e-webui
        cmd = f"""
        source "{common_lib}"
        source "{incus_lib}"
        source "{detect_lib}"
        detect_deployment_state "e-webui-app" "/opt/e-webui"
        """
        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.strip(), "UNMANAGED")

        # 3. Managed container
        c_root = self.mock_state.containers_dir / "e-webui-app"
        (c_root / "opt" / "e-webui" / "releases").mkdir(parents=True, exist_ok=True)
        (c_root / "opt" / "e-webui" / ".deploy_state").write_text('{"schema_version": 2}')
        cmd = f"""
        source "{common_lib}"
        source "{incus_lib}"
        source "{detect_lib}"
        detect_deployment_state "e-webui-app" "/opt/e-webui"
        """
        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.strip(), "MANAGED")

    def test_state_manager_commit_and_rollback(self):
        """Verify state commit records previous release and rollback updates state."""
        state_lib = REPO_ROOT / "scripts" / "lib" / "state.sh"
        incus_lib = REPO_ROOT / "scripts" / "lib" / "incus.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        c_root = self.mock_state.containers_dir / "e-webui-app"
        (c_root / "opt" / "e-webui").mkdir(parents=True, exist_ok=True)

        cmd = f"""
        source "{common_lib}"
        source "{incus_lib}"
        source "{state_lib}"
        state_commit_release "e-webui-app" "/opt/e-webui" "rel-001" "hash123" 8080 "127.0.0.1:11434"
        state_commit_release "e-webui-app" "/opt/e-webui" "rel-002" "hash123" 8080 "127.0.0.1:11434"
        echo "ACTIVE: $(state_get_active_release e-webui-app /opt/e-webui)"
        echo "PREV: $(state_get_previous_healthy_release e-webui-app /opt/e-webui)"
        """
        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("ACTIVE: rel-002", res.stdout)
        self.assertIn("PREV: rel-001", res.stdout)

    def test_uninstall_preserves_shared_data_by_default(self):
        """Verify run_uninstall_cli preserves /opt/e-webui/shared unless purge flag is set."""
        uninstall_lib = REPO_ROOT / "scripts" / "lib" / "uninstall.sh"
        service_lib = REPO_ROOT / "scripts" / "lib" / "service.sh"
        incus_lib = REPO_ROOT / "scripts" / "lib" / "incus.sh"
        lock_lib = REPO_ROOT / "scripts" / "lib" / "lock.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        c_root = self.mock_state.containers_dir / "e-webui-app"
        app_dir = c_root / "opt" / "e-webui"
        shared_dir = app_dir / "shared"
        shared_dir.mkdir(parents=True, exist_ok=True)
        (shared_dir / ".env").write_text("MY_SECRET=123")
        (app_dir / "current").mkdir()

        # Run uninstall without purge
        cmd = f"""
        source "{common_lib}"
        source "{incus_lib}"
        source "{lock_lib}"
        source "{service_lib}"
        source "{uninstall_lib}"
        run_uninstall_cli "e-webui-app" "/opt/e-webui" 0
        """
        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        # Shared data must survive
        self.assertTrue((shared_dir / ".env").exists())
        self.assertEqual((shared_dir / ".env").read_text(), "MY_SECRET=123")
        # Current link should be gone
        self.assertFalse((app_dir / "current").exists())

    def test_legacy_detection_and_migration(self):
        """Verify is_legacy_deployment detects legacy marker and migration restructures files."""
        detect_lib = REPO_ROOT / "scripts" / "lib" / "detect.sh"
        migrate_lib = REPO_ROOT / "scripts" / "lib" / "migrate.sh"
        service_lib = REPO_ROOT / "scripts" / "lib" / "service.sh"
        incus_lib = REPO_ROOT / "scripts" / "lib" / "incus.sh"
        lock_lib = REPO_ROOT / "scripts" / "lib" / "lock.sh"
        state_lib = REPO_ROOT / "scripts" / "lib" / "state.sh"
        release_lib = REPO_ROOT / "scripts" / "lib" / "release.sh"
        provision_lib = REPO_ROOT / "scripts" / "lib" / "provision.sh"
        health_lib = REPO_ROOT / "scripts" / "lib" / "health.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"

        c_root = self.mock_state.containers_dir / "e-webui-app"
        app_dir = c_root / "opt" / "e-webui"
        app_dir.mkdir(parents=True, exist_ok=True)
        (app_dir / ".deploy_state").write_text("STEP_0_CONTAINER_PROVISIONED=2026-11-05\nSTEP_5_HEALTH_VERIFIED=2026-11-05\n")
        (app_dir / "app").mkdir()
        (app_dir / "app" / "main.py").write_text("# legacy main")
        (app_dir / "requirements.txt").write_text("fastapi==0.100.0\n")
        (app_dir / "venv").mkdir()
        (app_dir / "venv" / "bin").mkdir()
        (app_dir / "venv" / "bin" / "python3").write_text("# dummy")

        # Check detection
        cmd = f"""
        source "{common_lib}"
        source "{incus_lib}"
        source "{detect_lib}"
        is_legacy_deployment "e-webui-app" "/opt/e-webui" && echo "IS_LEGACY" || echo "NOT_LEGACY"
        """
        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.strip(), "IS_LEGACY")

    def test_status_and_repair_diagnostics(self):
        """Verify status outputs release metadata and repair restores missing current link."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"

        c_root = self.mock_state.containers_dir / "e-webui-app"
        app_dir = c_root / "opt" / "e-webui"
        (app_dir / "releases" / "20261106-999999").mkdir(parents=True, exist_ok=True)
        state_content = '{"schema_version": 2, "container_name": "e-webui-app", "active_release": "20261106-999999", "previous_healthy_release": null, "active_venv_hash": "a1b2c3d4", "host_port": 8080, "ollama_target": "127.0.0.1:11434", "installed_at": "2026-11-06T00:00:00Z", "last_updated_at": "2026-11-06T00:00:00Z", "history": []}'
        (app_dir / ".deploy_state").write_text(state_content)

        # 1. Run status
        res = subprocess.run(["bash", str(deploy_sh), "--status", "e-webui-app"], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0)
        self.assertIn("Active Release:", res.stdout)
        self.assertIn("20261106-999999", res.stdout)

    def _build_test_release_package(self, out_dir: Path, version="1.0.0", release_id="20261106-120000-a1b2c3d4"):
        pkg_dir = out_dir / release_id
        payload_dir = pkg_dir / "payload"
        payload_dir.mkdir(parents=True, exist_ok=True)

        app_tar = payload_dir / "app.tar.gz"
        with tarfile.open(app_tar, "w:gz") as tar:
            info = tarfile.TarInfo(name="app/main.py")
            content = b"# deployed app\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        req_txt = payload_dir / "requirements.txt"
        req_txt.write_text("fastapi>=0.110.0\n")

        systemd_dir = payload_dir / "systemd"
        systemd_dir.mkdir(exist_ok=True)
        svc = systemd_dir / "e-webui.service"
        svc.write_text("[Unit]\nDescription=e-webui Service\n")

        manifest_tool = REPO_ROOT / "scripts" / "lib" / "manifest_tool.py"
        subprocess.run([
            "python3", str(manifest_tool), "create-manifest",
            "--release-dir", str(pkg_dir),
            "--version", version,
            "--release-id", release_id,
            "--git-commit", "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
            "--git-branch", "main",
        ], check=True, capture_output=True)

        return pkg_dir

    def _build_test_release_tarball(self, out_dir: Path, version="1.0.0", release_id="20261106-120000-a1b2c3d4"):
        pkg_dir = self._build_test_release_package(out_dir, version=version, release_id=release_id)
        tar_path = out_dir / f"e-webui-{version}-{release_id}.tar.gz"
        with tarfile.open(tar_path, "w:gz") as tar:
            for item in pkg_dir.iterdir():
                tar.add(item, arcname=item.name)
        return tar_path

    def test_prepare_release_package_on_host_tarball(self):
        """Verify prepare_release_package_on_host outputs strictly the staging path for tarballs."""
        tar_pkg = self._build_test_release_tarball(self.temp_dir, version="1.0.0", release_id="20261106-180000-a1b2c3d4-tarball")
        stage_dir = self.temp_dir / "stage_test"
        stage_dir.mkdir()

        archive_lib = REPO_ROOT / "scripts" / "lib" / "archive.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"
        cmd = f'source "{common_lib}" && source "{archive_lib}" && prepare_release_package_on_host "{tar_pkg}" "{stage_dir}"'

        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Failed: {res.stderr}")
        # The output must be strictly a single path line without [VALID] message
        output_lines = [line for line in res.stdout.strip().splitlines() if line]
        self.assertEqual(len(output_lines), 1, f"Expected single line path on stdout, got: {res.stdout}")
        self.assertEqual(output_lines[0], str(stage_dir))
        self.assertTrue((stage_dir / "manifest.json").exists())

    def test_deploy_consumes_tarball_release_package(self):
        """Verify deploy.sh successfully consumes, unpacks, and activates a .tar.gz release bundle."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        tar_pkg = self._build_test_release_tarball(self.temp_dir, version="1.0.0", release_id="20261106-190000-a1b2c3d4-bundle")

        c_root = self.mock_state.containers_dir / "e-webui-app"
        app_dir = c_root / "opt" / "e-webui"
        (app_dir / "releases" / "20261106-000000-00000000").mkdir(parents=True, exist_ok=True)
        (app_dir / "venvs").mkdir(parents=True, exist_ok=True)
        (app_dir / "shared" / "data").mkdir(parents=True, exist_ok=True)
        init_state = '{"schema_version": 2, "container_name": "e-webui-app", "active_release": "20261106-000000-00000000", "previous_healthy_release": null, "active_venv_hash": "dummy", "host_port": 8080, "ollama_target": "127.0.0.1:11434"}'
        (app_dir / ".deploy_state").write_text(init_state)

        res = subprocess.run(
            ["bash", str(deploy_sh), "--update", "--release", str(tar_pkg), "e-webui-app"],
            env=self.env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(res.returncode, 0, f"Deploy failed: {res.stderr}\nStdout: {res.stdout}")

        installed_rel = app_dir / "releases" / "20261106-190000-a1b2c3d4-bundle"
        self.assertTrue(installed_rel.exists(), "Extracted release directory missing")
        self.assertTrue((installed_rel / "manifest.json").exists(), "manifest.json missing")
        state_data = json.loads((app_dir / ".deploy_state").read_text())
        self.assertEqual(state_data.get("active_release"), "20261106-190000-a1b2c3d4-bundle")

    def test_verify_release_in_container_flattens_nested_staging(self):
        """Verify verify_release_in_container automatically flattens staging directory if nested."""
        rel_pkg = self._build_test_release_package(self.temp_dir, version="1.0.0", release_id="20261106-200000-a1b2c3d4-nested")
        c_root = self.mock_state.containers_dir / "e-webui-app"
        staging_dir = c_root / "opt" / "e-webui" / "staging" / "release-20261106-200000-a1b2c3d4-nested"
        nested_subdir = staging_dir / "temp_stage_basename"
        nested_subdir.mkdir(parents=True, exist_ok=True)
        # Copy release files inside nested subdirectory
        for item in rel_pkg.iterdir():
            if item.is_dir():
                shutil.copytree(item, nested_subdir / item.name)
            else:
                shutil.copy2(item, nested_subdir / item.name)

        archive_lib = REPO_ROOT / "scripts" / "lib" / "archive.sh"
        common_lib = REPO_ROOT / "scripts" / "lib" / "common.sh"
        incus_lib = REPO_ROOT / "scripts" / "lib" / "incus.sh"
        cmd = f'source "{common_lib}" && source "{incus_lib}" && source "{archive_lib}" && verify_release_in_container "e-webui-app" "/opt/e-webui/staging/release-20261106-200000-a1b2c3d4-nested"'

        res = subprocess.run(["bash", "-c", cmd], env=self.env, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Failed: {res.stderr}\nStdout: {res.stdout}")
        # Ensure checksums.sha256 and manifest.json now reside directly in staging_dir
        self.assertTrue((staging_dir / "checksums.sha256").exists(), "checksums.sha256 was not flattened to staging root")
        self.assertTrue((staging_dir / "manifest.json").exists(), "manifest.json was not flattened to staging root")

    def test_deploy_rejects_missing_release(self):
        """Verify deploy halts with exit code 2 when no release package exists."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        empty_dist = self.temp_dir / "empty_dist"
        empty_dist.mkdir()

        res = subprocess.run(
            ["bash", str(deploy_sh), "--update", "--release", str(empty_dist / "non_existent"), "e-webui-app"],
            env=self.env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(res.returncode, 2)
        self.assertIn("does not exist", res.stderr + res.stdout)

    def test_deploy_consumes_valid_release_package(self):
        """Verify deploy.sh successfully consumes, extracts, and activates a pre-packaged release."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        rel_pkg = self._build_test_release_package(self.temp_dir, version="1.0.0", release_id="20261106-120000-a1b2c3d4")

        # Setup container in managed state
        c_root = self.mock_state.containers_dir / "e-webui-app"
        app_dir = c_root / "opt" / "e-webui"
        (app_dir / "releases" / "20261106-000000-00000000").mkdir(parents=True, exist_ok=True)
        (app_dir / "venvs").mkdir(parents=True, exist_ok=True)
        (app_dir / "shared" / "data").mkdir(parents=True, exist_ok=True)
        init_state = '{"schema_version": 2, "container_name": "e-webui-app", "active_release": "20261106-000000-00000000", "previous_healthy_release": null, "active_venv_hash": "dummy", "host_port": 8080, "ollama_target": "127.0.0.1:11434"}'
        (app_dir / ".deploy_state").write_text(init_state)

        res = subprocess.run(
            ["bash", str(deploy_sh), "--update", "--release", str(rel_pkg), "e-webui-app"],
            env=self.env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(res.returncode, 0, f"Deploy failed: {res.stderr}\nStdout: {res.stdout}")

        # Assert files extracted in container
        installed_rel = app_dir / "releases" / "20261106-120000-a1b2c3d4"
        self.assertTrue(installed_rel.exists(), "Extracted release directory missing")
        self.assertTrue((installed_rel / "manifest.json").exists(), "manifest.json not preserved in container")
        self.assertTrue((installed_rel / "checksums.sha256").exists(), "checksums.sha256 not preserved in container")
        self.assertTrue((installed_rel / "app" / "main.py").exists(), "app/main.py missing")
        self.assertTrue((installed_rel / "requirements.txt").exists(), "requirements.txt missing")

        # Check state file recorded release and version
        state_data = json.loads((app_dir / ".deploy_state").read_text())
        self.assertEqual(state_data.get("active_release"), "20261106-120000-a1b2c3d4")
        self.assertEqual(state_data.get("active_version"), "1.0.0")

    def test_deploy_rejects_tampered_release_checksum(self):
        """Verify deploy rejects tampered artifact on host before modifying container."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        rel_pkg = self._build_test_release_package(self.temp_dir, version="1.0.0", release_id="20261106-130000-tampered")

        # Tamper with requirements.txt
        (rel_pkg / "payload" / "requirements.txt").write_text("fastapi>=0.110.0\n# tampered\n")

        c_root = self.mock_state.containers_dir / "e-webui-app"
        app_dir = c_root / "opt" / "e-webui"
        (app_dir / "releases" / "20261106-000000-00000000").mkdir(parents=True, exist_ok=True)
        init_state = '{"schema_version": 2, "container_name": "e-webui-app", "active_release": "20261106-000000-00000000"}'
        (app_dir / ".deploy_state").write_text(init_state)

        res = subprocess.run(
            ["bash", str(deploy_sh), "--update", "--release", str(rel_pkg), "e-webui-app"],
            env=self.env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("Host Pre-flight Gate Failed", res.stderr + res.stdout)
        # Verify container state untouched
        state_data = json.loads((app_dir / ".deploy_state").read_text())
        self.assertEqual(state_data.get("active_release"), "20261106-000000-00000000")

    def test_deploy_rejects_path_traversal_archive(self):
        """Verify deploy pre-flight rejects archive containing path traversal sequences."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        rel_pkg = self._build_test_release_package(self.temp_dir, version="1.0.0", release_id="20261106-140000-a1b2c3d4-traversal")

        # Replace payload/app.tar.gz with unsafe member
        app_tar = rel_pkg / "payload" / "app.tar.gz"
        with tarfile.open(app_tar, "w:gz") as tar:
            info = tarfile.TarInfo(name="app/../../etc/shadow")
            content = b"root:x:0:0\n"
            info.size = len(content)
            import io
            tar.addfile(info, io.BytesIO(content))

        # Recompute checksums so hash matches, but contents violate safety
        manifest_tool = REPO_ROOT / "scripts" / "lib" / "manifest_tool.py"
        subprocess.run([
            "python3", str(manifest_tool), "create-manifest",
            "--release-dir", str(rel_pkg),
            "--version", "1.0.0",
            "--release-id", "20261106-140000-a1b2c3d4-traversal",
        ], check=True, capture_output=True)

        res = subprocess.run(
            ["bash", str(deploy_sh), "--update", "--release", str(rel_pkg), "e-webui-app"],
            env=self.env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("unsafe path", (res.stderr + res.stdout).lower())

    def test_deploy_rejects_unsupported_manifest_schema(self):
        """Verify deploy rejects manifest with unsupported major schema version."""
        deploy_sh = REPO_ROOT / "scripts" / "deploy.sh"
        rel_pkg = self._build_test_release_package(self.temp_dir, version="1.0.0", release_id="20261106-150000-a1b2c3d4-schema")

        m_file = rel_pkg / "manifest.json"
        data = json.loads(m_file.read_text())
        data["schema_version"] = "2.0.0"
        m_file.write_text(json.dumps(data, indent=2))

        res = subprocess.run(
            ["bash", str(deploy_sh), "--update", "--release", str(rel_pkg), "e-webui-app"],
            env=self.env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("schema", (res.stderr + res.stdout).lower())


if __name__ == "__main__":
    unittest.main()
