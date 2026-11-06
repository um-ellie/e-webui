"""Unit tests for frontend Markdown security and protocol allowlisting."""

import os
import shutil
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MARKED_JS = REPO_ROOT / "app" / "static" / "vendor" / "marked.min.js"


class TestMarkdownSecurity(unittest.TestCase):
    """Verifies that marked.min.js safely handles untrusted links and escapes XSS vectors."""

    def setUp(self):
        self.assertTrue(MARKED_JS.exists(), f"marked.min.js not found at {MARKED_JS}")

    def test_link_protocol_allowlisting_via_node(self):
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("node binary not found on system")

        script = f"""
        const marked = require({repr(str(MARKED_JS))});

        const testCases = [
            {{ md: '[safe](https://example.com)', allow: true, expected: 'href="https://example.com"' }},
            {{ md: '[http link](http://example.com)', allow: true, expected: 'href="http://example.com"' }},
            {{ md: '[mail](mailto:user@example.com)', allow: true, expected: 'href="mailto:user@example.com"' }},
            {{ md: '[rel](/docs/api)', allow: true, expected: 'href="/docs/api"' }},
            {{ md: '[evil js](javascript:alert(1))', allow: false, expected: 'href="#"' }},
            {{ md: '[evil data](data:text/html,<script>alert(1)</script>)', allow: false, expected: 'href="#"' }},
            {{ md: '[vbscript](vbscript:msgbox)', allow: false, expected: 'href="#"' }},
        ];

        let failed = [];
        for (const tc of testCases) {{
            const html = marked.parse(tc.md);
            if (tc.allow) {{
                if (!html.includes(tc.expected)) {{
                    failed.push(`Allowed link expected ${{tc.expected}}, got: ${{html}}`);
                }}
            }} else {{
                if (html.includes('javascript:') || html.includes('data:') || html.includes('vbscript:')) {{
                    failed.push(`Dangerous scheme passed through in: ${{html}}`);
                }}
                if (!html.includes('href="#"')) {{
                    failed.push(`Expected href="#" for neutralized link, got: ${{html}}`);
                }}
            }}
        }}

        if (failed.length > 0) {{
            console.error(failed.join('\\n'));
            process.exit(1);
        }}
        console.log("PASS");
        """

        res = subprocess.run([node_bin, "-e", script], capture_output=True, text=True)
        self.assertEqual(
            res.returncode,
            0,
            f"Node test failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}",
        )
        self.assertIn("PASS", res.stdout)


if __name__ == "__main__":
    unittest.main()
