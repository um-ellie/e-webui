#!/usr/bin/env python3
"""scripts/lib/manifest_tool.py - Manifest generation, schema validation, and artifact verification.

Pure Python standard library implementation ensuring zero external runtime dependencies.
Conforms strictly to specs/009-release-artifact-packaging/contracts/manifest-schema.json.
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import tarfile
from pathlib import Path

SUPPORTED_SCHEMA_MAJOR = 1
SEMVER_REGEX = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$")
RELEASE_ID_REGEX = re.compile(r"^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}(-[a-z0-9]+)?$")
SHA256_REGEX = re.compile(r"^[a-f0-9]{64}$")


def sha256_of_file(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def cmd_validate_manifest(args: argparse.Namespace) -> int:
    manifest_path = Path(args.manifest_file).resolve()
    if not manifest_path.is_file():
        sys.stderr.write(f"[ERROR] Manifest file not found: {manifest_path}\n")
        return 2

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        sys.stderr.write(f"[ERROR] Failed to parse manifest JSON: {e}\n")
        return 2

    errors = []

    # Check schema_version
    schema_ver = data.get("schema_version")
    if not schema_ver or not isinstance(schema_ver, str):
        errors.append("Missing or invalid 'schema_version'")
    else:
        parts = schema_ver.split(".")
        if len(parts) != 3 or not parts[0].isdigit():
            errors.append(f"Invalid 'schema_version' format: {schema_ver}")
        elif int(parts[0]) != SUPPORTED_SCHEMA_MAJOR:
            errors.append(
                f"Unsupported schema_version '{schema_ver}'. "
                f"This tool only supports major version {SUPPORTED_SCHEMA_MAJOR}.x"
            )

    # Check application
    if data.get("application") != "e-webui":
        errors.append(f"Invalid application name: expected 'e-webui', got '{data.get('application')}'")

    # Check version
    ver = data.get("version")
    if not ver or not isinstance(ver, str) or not SEMVER_REGEX.match(ver):
        errors.append(f"Invalid SemVer 'version': {ver}")

    # Check release_id
    rel_id = data.get("release_id")
    if not rel_id or not isinstance(rel_id, str) or not RELEASE_ID_REGEX.match(rel_id):
        errors.append(f"Invalid 'release_id' format: {rel_id}")

    # Check created_at
    created_at = data.get("created_at")
    if not created_at or not isinstance(created_at, str):
        errors.append("Missing or invalid 'created_at'")
    else:
        try:
            # Python 3.11+ supports ISO format directly
            datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            errors.append(f"Invalid ISO-8601 'created_at': {created_at}")

    # Check compatibility
    compat = data.get("compatibility")
    if not isinstance(compat, dict):
        errors.append("Missing or invalid 'compatibility' object")
    else:
        if not compat.get("min_deployment_manager_version"):
            errors.append("Missing 'compatibility.min_deployment_manager_version'")
        if not compat.get("python_version"):
            errors.append("Missing 'compatibility.python_version'")

    # Check artifacts
    artifacts = data.get("artifacts")
    if not isinstance(artifacts, list) or len(artifacts) < 3:
        errors.append("Missing or insufficient 'artifacts' list (minimum 3 required)")
    else:
        release_root = manifest_path.parent
        valid_purposes = {"app_source", "dependencies", "service_unit", "verification"}
        for idx, art in enumerate(artifacts):
            if not isinstance(art, dict):
                errors.append(f"Artifact #{idx} is not an object")
                continue
            art_name = art.get("name")
            art_path_rel = art.get("path")
            art_hash = art.get("sha256")
            art_size = art.get("size_bytes")
            art_purpose = art.get("purpose")

            if not art_name or not art_path_rel or not art_hash or art_size is None or not art_purpose:
                errors.append(f"Artifact #{idx} ({art_name}) missing required fields")
                continue

            if not SHA256_REGEX.match(art_hash):
                errors.append(f"Artifact '{art_name}' has invalid sha256 digest format")

            if art_purpose not in valid_purposes:
                errors.append(f"Artifact '{art_name}' has invalid purpose '{art_purpose}'")

            target_file = release_root / art_path_rel
            if not target_file.is_file():
                errors.append(f"Artifact file not found on disk: {art_path_rel}")
            else:
                actual_size = target_file.stat().st_size
                if actual_size != art_size:
                    errors.append(
                        f"Artifact '{art_name}' size mismatch: expected {art_size}, got {actual_size}"
                    )
                actual_hash = sha256_of_file(target_file)
                if actual_hash != art_hash:
                    errors.append(
                        f"Artifact '{art_name}' SHA-256 digest mismatch: expected {art_hash}, got {actual_hash}"
                    )

    if errors:
        sys.stderr.write("[ERROR] Manifest validation failed:\n")
        for err in errors:
            sys.stderr.write(f"  - {err}\n")
        return 2

    print(f"[VALID] Manifest '{manifest_path.name}' conforms to schema v{schema_ver} and all artifacts match.")
    return 0


def cmd_verify_checksums(args: argparse.Namespace) -> int:
    checksums_path = Path(args.checksums_file).resolve()
    if not checksums_path.is_file():
        sys.stderr.write(f"[ERROR] Checksums file not found: {checksums_path}\n")
        return 2

    base_dir = checksums_path.parent
    errors = []
    verified_count = 0

    with open(checksums_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split(None, 1)
            if len(parts) != 2:
                errors.append(f"Line {line_num}: Malformed checksum line")
                continue

            expected_hash, rel_path = parts
            target_path = base_dir / rel_path

            if not target_path.is_file():
                errors.append(f"File not found: {rel_path}")
                continue

            actual_hash = sha256_of_file(target_path)
            if actual_hash.lower() != expected_hash.lower():
                errors.append(
                    f"Checksum mismatch for '{rel_path}': expected {expected_hash}, got {actual_hash}"
                )
            else:
                verified_count += 1

    if errors:
        sys.stderr.write("[ERROR] Checksums verification failed:\n")
        for err in errors:
            sys.stderr.write(f"  - {err}\n")
        return 2

    print(f"[VALID] All checksums verified ({verified_count}/{verified_count} files).")
    return 0


def cmd_verify_archive(args: argparse.Namespace) -> int:
    archive_path = Path(args.archive_file).resolve()
    if not archive_path.is_file():
        sys.stderr.write(f"[ERROR] Archive file not found: {archive_path}\n")
        return 2

    errors = []
    try:
        with tarfile.open(archive_path, "r:*") as tar:
            for member in tar.getmembers():
                name = member.name
                # Check absolute paths
                if name.startswith("/") or name.startswith("\\"):
                    errors.append(f"Absolute path forbidden: '{name}'")
                # Check directory traversal
                parts = Path(name).parts
                if ".." in parts:
                    errors.append(f"Path traversal sequence forbidden: '{name}'")
                # Check symlink destination
                if member.issym() or member.islnk():
                    link_target = member.linkname
                    if link_target.startswith("/") or link_target.startswith("\\"):
                        errors.append(f"Symlink to absolute path forbidden: '{name}' -> '{link_target}'")
                    link_parts = Path(link_target).parts
                    if ".." in link_parts:
                        # Ensure normalized target stays relative
                        norm = os.path.normpath(os.path.join(os.path.dirname(name), link_target))
                        if norm.startswith("..") or norm.startswith("/"):
                            errors.append(f"Symlink escapes root: '{name}' -> '{link_target}'")
    except Exception as e:
        sys.stderr.write(f"[ERROR] Failed to read archive '{archive_path}': {e}\n")
        return 2

    if errors:
        sys.stderr.write("[ERROR] Archive safety verification failed:\n")
        for err in errors:
            sys.stderr.write(f"  - {err}\n")
        return 3

    if not getattr(args, "quiet", False):
        print(f"[VALID] Archive '{archive_path.name}' is verified safe for extraction.")
    return 0


def cmd_create_manifest(args: argparse.Namespace) -> int:
    release_dir = Path(args.release_dir).resolve()
    payload_dir = release_dir / "payload"
    if not payload_dir.is_dir():
        sys.stderr.write(f"[ERROR] Payload directory missing: {payload_dir}\n")
        return 2

    app_tar = payload_dir / "app.tar.gz"
    req_file = payload_dir / "requirements.txt"
    service_file = payload_dir / "systemd" / "e-webui.service"

    required_artifacts = [
        ("app.tar.gz", "payload/app.tar.gz", app_tar, "app_source"),
        ("requirements.txt", "payload/requirements.txt", req_file, "dependencies"),
        ("e-webui.service", "payload/systemd/e-webui.service", service_file, "service_unit"),
    ]

    for name, rel_path, full_path, _ in required_artifacts:
        if not full_path.is_file():
            sys.stderr.write(f"[ERROR] Required payload file missing: {rel_path}\n")
            return 2

    artifacts_meta = []
    checksums_entries = []

    for name, rel_path, full_path, purpose in required_artifacts:
        f_hash = sha256_of_file(full_path)
        f_size = full_path.stat().st_size
        artifacts_meta.append({
            "name": name,
            "path": rel_path,
            "sha256": f_hash,
            "size_bytes": f_size,
            "purpose": purpose,
        })
        checksums_entries.append(f"{f_hash}  {rel_path}")

    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    manifest_data = {
        "schema_version": "1.0.0",
        "application": "e-webui",
        "version": args.version,
        "release_id": args.release_id,
        "created_at": now_utc,
        "git": {
            "commit": args.git_commit if args.git_commit else None,
            "branch": args.git_branch if args.git_branch else None,
            "dirty": bool(args.git_dirty),
        },
        "compatibility": {
            "min_deployment_manager_version": args.min_manager_version,
            "python_version": args.python_version,
            "target_os": args.target_os,
        },
        "artifacts": artifacts_meta,
        "metadata": {
            "builder": "e-webui-release-builder/1.0.0",
            "notes": args.notes if args.notes else "Standard release package",
        },
    }

    manifest_path = release_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    manifest_hash = sha256_of_file(manifest_path)
    checksums_entries.append(f"{manifest_hash}  manifest.json")

    checksums_path = release_dir / "checksums.sha256"
    with open(checksums_path, "w", encoding="utf-8") as f:
        f.write("\n".join(checksums_entries) + "\n")

    print(f"[SUCCESS] Generated manifest.json and checksums.sha256 in {release_dir}")
    return 0


def cmd_read_field(args: argparse.Namespace) -> int:
    manifest_path = Path(args.manifest_file).resolve()
    if not manifest_path.is_file():
        sys.stderr.write(f"[ERROR] Manifest file not found: {manifest_path}\n")
        return 2

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        sys.stderr.write(f"[ERROR] Failed to parse manifest JSON: {e}\n")
        return 2

    keys = args.field.split(".")
    curr = data
    for k in keys:
        if isinstance(curr, dict) and k in curr:
            curr = curr[k]
        else:
            curr = None
            break

    if curr is not None:
        if isinstance(curr, bool):
            print("true" if curr else "false")
        else:
            print(str(curr))
        return 0
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="e-webui Release Manifest and Artifact Tool")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # validate-manifest
    val_p = subparsers.add_parser("validate-manifest", help="Validate a manifest.json file against schema")
    val_p.add_argument("manifest_file", help="Path to manifest.json")
    val_p.set_defaults(func=cmd_validate_manifest)

    # verify-checksums
    chk_p = subparsers.add_parser("verify-checksums", help="Verify checksums.sha256")
    chk_p.add_argument("checksums_file", help="Path to checksums.sha256")
    chk_p.set_defaults(func=cmd_verify_checksums)

    # verify-archive
    arc_p = subparsers.add_parser("verify-archive", help="Verify tar archive for safe paths")
    arc_p.add_argument("archive_file", help="Path to .tar.gz archive")
    arc_p.add_argument("-q", "--quiet", action="store_true", help="Suppress safe verification banner")
    arc_p.set_defaults(func=cmd_verify_archive)

    # create-manifest
    create_p = subparsers.add_parser("create-manifest", help="Create manifest.json and checksums.sha256")
    create_p.add_argument("--release-dir", required=True, help="Path to staged release directory")
    create_p.add_argument("--version", required=True, help="Application SemVer version")
    create_p.add_argument("--release-id", required=True, help="Unique release ID")
    create_p.add_argument("--git-commit", default=None, help="Git commit hash")
    create_p.add_argument("--git-branch", default=None, help="Git branch")
    create_p.add_argument("--git-dirty", action="store_true", help="Flag if working tree was dirty")
    create_p.add_argument("--min-manager-version", default="1.0.0", help="Min deploy manager version")
    create_p.add_argument("--python-version", default=">=3.11", help="Target Python version")
    create_p.add_argument("--target-os", default="debian-12", help="Target OS")
    create_p.add_argument("--notes", default="", help="Release notes")
    create_p.set_defaults(func=cmd_create_manifest)

    # read-field
    read_p = subparsers.add_parser("read-field", help="Read a dotted field from manifest.json")
    read_p.add_argument("manifest_file", help="Path to manifest.json")
    read_p.add_argument("field", help="Dotted field path (e.g. version or git.commit)")
    read_p.set_defaults(func=cmd_read_field)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
