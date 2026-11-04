#!/usr/bin/env python3
"""Audit script to verify that legacy names have been removed and replaced by e-webui,
while honoring allowed third-party and container infrastructure exclusions."""

import os
import re
import sys

TARGET_PATTERNS = [
    ("ellie-ollama-webui", re.compile(r"ellie[\s\-_]ollama[\s\-_]webui", re.IGNORECASE)),
    ("ollama-webui", re.compile(r"ollama[\s\-_]web[\s\-_]?ui", re.IGNORECASE)),
    ("web-ui", re.compile(r"\bweb[\s\-_]ui\b", re.IGNORECASE)),
    ("webui", re.compile(r"\bwebui\b", re.IGNORECASE)),
]

ALLOWED_EXCLUSION_PATTERNS = [
    re.compile(r"open[\-_ ]?webui", re.IGNORECASE),
    re.compile(r"e[\-_]webui", re.IGNORECASE),
    re.compile(r"webui[\-_]proxy", re.IGNORECASE),
    re.compile(r'CONTAINER_NAME=.*webui', re.IGNORECASE),
    re.compile(r'incus\s+.*webui', re.IGNORECASE),
    re.compile(r'container\s+`?webui`?', re.IGNORECASE),
    re.compile(r'container\s+"webui"', re.IGNORECASE),
    re.compile(r'proxy\s+device', re.IGNORECASE),
]

EXCLUDE_DIRS = {".git", ".pytest_cache", "__pycache__", "node_modules", "scratch"}
# We also ignore specs/002-rebrand-e-webui because its spec and tasks explicitly mention the legacy names in historical requirements
EXCLUDE_PATHS = {"specs/002-rebrand-e-webui"}


def is_excluded_line(line: str) -> bool:
    for exc in ALLOWED_EXCLUSION_PATTERNS:
        if exc.search(line):
            # Check if line ONLY contains allowed forms
            # If line contains both allowed and disallowed, check matches
            pass
    return False


def audit_file(filepath: str):
    issues = []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for idx, line in enumerate(f, 1):
            stripped = line.strip()
            for name, pattern in TARGET_PATTERNS:
                matches = list(pattern.finditer(line))
                if not matches:
                    continue
                # For each match, check if it's part of an allowed exclusion
                for m in matches:
                    matched_str = m.group(0)
                    start, end = m.span()
                    # Check context before and after
                    prefix = line[max(0, start - 10):start].lower()
                    full_context = line[max(0, start - 15):min(len(line), end + 15)].lower()

                    if "open-webui" in full_context or "open_webui" in full_context or "open webui" in full_context:
                        continue
                    if "e-webui" in full_context or "e_webui" in full_context:
                        continue
                    if "webui-proxy" in full_context:
                        continue
                    if "container" in line.lower() and ("webui" in matched_str.lower()):
                        continue
                    if "proxy device" in line.lower():
                        continue
                    if "incus" in line.lower():
                        continue
                    if "container_name" in line:
                        continue

                    issues.append((idx, name, matched_str, stripped))
    return issues


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    total_issues = 0
    checked_files = 0

    print(f"Scanning repository: {repo_root}")

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        rel_root = os.path.relpath(root, repo_root)
        if any(rel_root.startswith(exp) for exp in EXCLUDE_PATHS):
            continue

        for file in files:
            filepath = os.path.join(root, file)
            rel_path = os.path.relpath(filepath, repo_root)
            checked_files += 1

            issues = audit_file(filepath)
            if issues:
                print(f"\n[FILE] {rel_path}:")
                for line_no, rule, matched, text in issues:
                    print(f"  L{line_no} ({rule}): '{matched}' -> {text}")
                    total_issues += 1

    print(f"\nAudit complete: checked {checked_files} files.")
    if total_issues == 0:
        print("PASS: Zero legacy naming occurrences found (excluding allowed infrastructure/third-party).")
        sys.exit(0)
    else:
        print(f"FAIL: Found {total_issues} occurrences needing review or renaming.")
        sys.exit(1)


if __name__ == "__main__":
    main()
