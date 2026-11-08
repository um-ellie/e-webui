"""Mock Incus CLI harness for isolated local testing.

Complies strictly with Constitution Principle I (Infrastructure Isolation):
Enables testing all deployment script logic without invoking real container APIs.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


class MockIncusState:
    """Holds simulated Incus container filesystem and runtime state."""

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.containers_dir = base_dir / "containers"
        self.containers_dir.mkdir(parents=True, exist_ok=True)
        self.calls_log = base_dir / "calls.jsonl"
        self.containers: Dict[str, Dict[str, Any]] = {}

    def log_call(self, args: List[str]):
        with open(self.calls_log, "a", encoding="utf-8") as f:
            f.write(json.dumps(args) + "\n")

    def get_calls(self) -> List[List[str]]:
        if not self.calls_log.exists():
            return []
        with open(self.calls_log, "r", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def add_container(self, name: str, status: str = "RUNNING", devices: Optional[Dict[str, Any]] = None):
        c_root = self.containers_dir / name
        c_root.mkdir(parents=True, exist_ok=True)
        c_info_file = self.base_dir / f"container_{name}.json"
        c_info_file.write_text(json.dumps({"status": status}))
        self.containers[name] = {
            "name": name,
            "status": status,
            "root": c_root,
            "devices": devices or {
                "webui-proxy": {"type": "proxy", "listen": "tcp:127.0.0.1:8080", "connect": "tcp:127.0.0.1:8080"},
                "ollama-link": {"type": "proxy", "listen": "tcp:127.0.0.1:11434", "connect": "tcp:127.0.0.1:11434"},
            },
        }

    def remove_container(self, name: str):
        if name in self.containers:
            del self.containers[name]
        c_root = self.containers_dir / name
        if c_root.exists():
            shutil.rmtree(c_root)


MOCK_PY311_WRAPPER = """#!/usr/bin/env python3
import sys
if "-V" in sys.argv or "--version" in sys.argv:
    print("Python 3.11.9")
    sys.exit(0)
if len(sys.argv) > 2 and sys.argv[1] == "-c":
    code = sys.argv[2]
    sys.version_info = (3, 11, 9, "final", 0)
    exec(code)
    sys.exit(0)
"""

def create_mock_cli_script(mock_state_dir: Path) -> Path:
    """Generates an executable mock incus bash script pointing to state directory."""
    script_path = mock_state_dir / "mock_incus"
    content = f"""#!/usr/bin/env bash
set -e
STATE_DIR="{mock_state_dir}"
python3 "{Path(__file__).resolve()}" "$@"
"""
    script_path.write_text(content)
    script_path.chmod(0o755)
    return script_path


def handle_cli():
    """CLI dispatcher when mock_incus is executed by subprocess."""
    state_dir = Path(os.environ.get("MOCK_INCUS_STATE_DIR", "/tmp/mock_incus_state"))
    state = MockIncusState(state_dir)
    args = sys.argv[1:]
    state.log_call(args)

    if not args:
        print("Incus Mock CLI", file=sys.stderr)
        sys.exit(0)

    cmd = args[0]

    # incus info <container>
    if cmd == "info":
        if len(args) < 2:
            sys.exit(1)
        name = args[1]
        c_info_file = state_dir / f"container_{name}.json"
        if not c_info_file.exists():
            print(f"Error: Not found: {name}", file=sys.stderr)
            sys.exit(1)
        c_data = json.loads(c_info_file.read_text())
        print(f"Name: {name}")
        print(f"Status: {c_data.get('status', 'RUNNING')}")
        print("Type: container")
        print("Architecture: x86_64")
        sys.exit(0)

    # incus launch <image> <name>
    if cmd == "launch":
        name = args[2] if len(args) > 2 else "e-webui-app"
        c_root = state.containers_dir / name
        c_root.mkdir(parents=True, exist_ok=True)
        c_info_file = state_dir / f"container_{name}.json"
        c_info_file.write_text(json.dumps({"status": "RUNNING"}))
        print(f"Creating {name}")
        print(f"Starting {name}")
        sys.exit(0)

    # incus start <name>
    if cmd == "start":
        name = args[1]
        c_info_file = state_dir / f"container_{name}.json"
        if c_info_file.exists():
            c_data = json.loads(c_info_file.read_text())
            c_data["status"] = "RUNNING"
            c_info_file.write_text(json.dumps(c_data))
        sys.exit(0)

    # incus exec <name> [--] <command...>
    if cmd == "exec":
        name = args[1]
        cmd_args = args[2:]
        if cmd_args and cmd_args[0] == "--":
            cmd_args = cmd_args[1:]

        c_root = state.containers_dir / name
        c_root.mkdir(parents=True, exist_ok=True)

        def map_path(s: str) -> str:
            if str(c_root) in s:
                return s
            return s.replace("/opt/e-webui", str(c_root / "opt" / "e-webui"))

        cmd_args = [map_path(a) for a in cmd_args]
        full_cmd = " ".join(cmd_args)
        # Handle direct commands
        if cmd_args and cmd_args[0] == "test":
            path_part = Path(cmd_args[-1])
            sys.exit(0 if path_part.exists() else 1)

        if cmd_args and cmd_args[0] == "mkdir":
            path_part = Path(cmd_args[-1])
            path_part.mkdir(parents=True, exist_ok=True)
            sys.exit(0)

        if "dpkg -s" in full_cmd:
            pkg_flag = state_dir / f"{name}_missing_audio_pkgs"
            if pkg_flag.exists():
                sys.exit(1)
            sys.exit(0)

        if "apt-get install" in full_cmd:
            pkg_flag = state_dir / f"{name}_missing_audio_pkgs"
            if pkg_flag.exists():
                pkg_flag.unlink(missing_ok=True)
            sys.exit(0)

        if "-m venv" in full_cmd:
            target_venv = Path(cmd_args[-1])
            (target_venv / "bin").mkdir(parents=True, exist_ok=True)
            (target_venv / "bin" / "python3").write_text(MOCK_PY311_WRAPPER)
            (target_venv / "bin" / "uvicorn").write_text("#!/bin/sh\n")
            (target_venv / "bin" / "pip").write_text("#!/bin/sh\n")
            (target_venv / "bin" / "python3").chmod(0o755)
            (target_venv / "bin" / "uvicorn").chmod(0o755)
            (target_venv / "bin" / "pip").chmod(0o755)
            sys.exit(0)

        if "pip" in full_cmd and "install" in full_cmd:
            sys.exit(0)

        if "systemctl" in full_cmd:
            if "is-active" in full_cmd:
                active_flag = state_dir / f"{name}_service_active"
                if active_flag.exists() and active_flag.read_text().strip() == "1":
                    print("active")
                    sys.exit(0)
                elif not active_flag.exists():
                    print("active")
                    sys.exit(0)
                else:
                    print("inactive")
                    sys.exit(3)
            sys.exit(0)

        if "curl" in full_cmd:
            fail_flag = state_dir / "fail_model_download"
            sim_404_flag = state_dir / "simulate_v1_404"
            is_model_dl = "kokoro" in full_cmd or "huggingface" in full_cmd or "voices" in full_cmd or "192.0.2.1" in full_cmd
            if is_model_dl and (fail_flag.exists() or "192.0.2.1" in full_cmd or os.environ.get("FAIL_MODEL_DOWNLOAD") == "1"):
                sys.exit(7)
            if (sim_404_flag.exists() or os.environ.get("SIMULATE_V1_404") == "1") and "kokoro-v1_0.pth" in full_cmd:
                sys.exit(22)
            if "%{http_code}" in full_cmd:
                print("200")
                sys.exit(0)
            import shlex
            try:
                tokens = shlex.split(full_cmd)
            except Exception:
                tokens = full_cmd.split()
            if "-o" in tokens:
                idx = tokens.index("-o")
                if idx + 1 < len(tokens):
                    out_path_str = map_path(tokens[idx + 1])
                    out_file = Path(out_path_str)
                    out_file.parent.mkdir(parents=True, exist_ok=True)
                    if "kokoro-v0_19.pth" in str(out_file) or "kokoro-v1_0.pth" in str(out_file):
                        with open(out_file, "wb") as f:
                            f.seek(327000000 - 1)
                            f.write(b"\0")
                    elif "python-3.11" in str(out_file) or "python-standalone" in str(out_file):
                        import tarfile, io
                        bio = io.BytesIO()
                        with tarfile.open(fileobj=bio, mode="w:gz") as tar:
                            p_bytes = MOCK_PY311_WRAPPER.encode("utf-8")
                            p_info = tarfile.TarInfo(name="python/bin/python3")
                            p_info.size = len(p_bytes)
                            p_info.mode = 0o755
                            tar.addfile(p_info, io.BytesIO(p_bytes))
                        out_file.write_bytes(bio.getvalue())
                    elif ".pt" in str(out_file):
                        out_file.write_bytes(b"mock voice embedding")
                    elif "config.json" in str(out_file):
                        out_file.write_text('{"hidden_size": 768}')
                    else:
                        out_file.write_text("mock content")
                sys.exit(0)
            sys.exit(0)

        # Run within simulated root
        if cmd_args and (cmd_args[0] in ("python3", "python", "bash", "sh") or cmd_args[0].endswith("python3") or cmd_args[0].endswith("python")):
            res = subprocess.run(cmd_args, cwd=str(c_root))
        else:
            res = subprocess.run(full_cmd, shell=True, cwd=str(c_root))
        sys.exit(res.returncode)

    # incus file push ...
    if cmd == "file" and len(args) > 1 and args[1] == "push":
        # Format: incus file push [-r] <source...> <container><dest>
        dest_token = args[-1]
        source_tokens = [a for a in args[2:-1] if not a.startswith("-")]
        if ":" in dest_token:
            c_name, c_path = dest_token.split(":", 1)
        elif "/" in dest_token:
            # e.g., container_name/opt/e-webui/...
            c_name = dest_token.split("/")[0]
            c_path = "/" + "/".join(dest_token.split("/")[1:])
        else:
            c_name = dest_token
            c_path = "/"

        c_root = state.containers_dir / c_name
        dest_full = c_root / c_path.lstrip("/")
        dest_is_dir = dest_token.endswith("/") or dest_full.is_dir() or len(source_tokens) > 1
        if dest_is_dir:
            dest_full.mkdir(parents=True, exist_ok=True)

        for s_tok in source_tokens:
            src = Path(s_tok)
            if src.is_dir():
                shutil.copytree(src, dest_full / src.name, dirs_exist_ok=True)
            elif src.is_file():
                if dest_is_dir:
                    shutil.copy2(src, dest_full / src.name)
                else:
                    dest_full.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dest_full)
        sys.exit(0)

    # incus config device ...
    if cmd == "config" and len(args) > 1 and args[1] == "device":
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    if len(sys.argv) > 1 and not sys.argv[1].endswith(".py"):
        handle_cli()
