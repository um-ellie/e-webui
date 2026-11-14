"""Unit tests for frontend Markdown security and protocol allowlisting."""

import os
import shutil
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MARKED_JS = REPO_ROOT / "app" / "static" / "vendor" / "marked.min.js"
PRISM_JS = REPO_ROOT / "app" / "static" / "vendor" / "prism.min.js"
MARKDOWN_JS = REPO_ROOT / "app" / "static" / "js" / "markdown.js"
INDEX_HTML = REPO_ROOT / "app" / "static" / "index.html"


class TestMarkdownSecurity(unittest.TestCase):
    """Verifies that marked.min.js safely handles untrusted links and escapes XSS vectors."""

    def setUp(self):
        self.assertTrue(MARKED_JS.exists(), f"marked.min.js not found at {MARKED_JS}")
        self.assertTrue(PRISM_JS.exists(), f"prism.min.js not found at {PRISM_JS}")
        self.assertTrue(MARKDOWN_JS.exists(), f"markdown.js not found at {MARKDOWN_JS}")
        self.assertTrue(INDEX_HTML.exists(), f"index.html not found at {INDEX_HTML}")

    def test_prism_vendor_file_contains_core_grammars(self):
        """Verifies that the offline prism.min.js bundle contains expected language grammars."""
        content = PRISM_JS.read_text(encoding="utf-8")
        self.assertIn("Prism", content)
        for grammar in ["languages.python", "languages.javascript", "languages.bash", "languages.json", "languages.yaml", "languages.sql"]:
            self.assertIn(grammar, content, f"Expected {grammar} in prism.min.js")

    def test_index_html_includes_prism_script(self):
        """Verifies that index.html loads prism.min.js before modular app scripts."""
        content = INDEX_HTML.read_text(encoding="utf-8")
        self.assertIn('<script src="/static/vendor/prism.min.js"></script>', content)

    def test_markdown_js_defines_language_aliases_and_badge_contract(self):
        """Verifies that markdown.js adheres to code-syntax-contract.md specifications."""
        content = MARKDOWN_JS.read_text(encoding="utf-8")
        self.assertIn("code-lang-badge", content)
        self.assertIn("code-container", content)
        self.assertIn('dir="ltr"', content)
        self.assertIn("btn-code-copy", content)
        self.assertIn("Prism", content)

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

    def test_render_markdown_compatibility_with_bundled_marked(self):
        """Verifies that renderMarkdown does not crash when window.marked has no Renderer constructor."""
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("node binary not found on system")

        markdown_js = REPO_ROOT / "app" / "static" / "js" / "markdown.js"
        self.assertTrue(markdown_js.exists(), f"markdown.js not found at {markdown_js}")

        script = f"""
        const marked = (await import({repr(str(MARKED_JS))})).default;
        const {{ renderMarkdown }} = await import({repr(str(markdown_js))});

        global.window = {{
            marked: marked
        }};

        const result = renderMarkdown('Hello **world**\\n\\n```python\\nprint(123)\\n```');
        if (!result.includes('<strong>world</strong>')) {{
            console.error('Failed to parse bold text');
            process.exit(1);
        }}
        if (!result.includes('language-python') && !result.includes('python')) {{
            console.error('Failed to parse code block');
            process.exit(1);
        }}
        console.log('PASS');
        """

        res = subprocess.run([node_bin, "--input-type=module", "-e", script], capture_output=True, text=True)
        self.assertEqual(
            res.returncode,
            0,
            f"renderMarkdown test failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}",
        )
        self.assertIn("PASS", res.stdout)

    def test_prism_syntax_highlighting_node(self):
        """Verifies that Prism highlights tokens with .token.keyword, .token.string classes."""
        node_bin = shutil.which("node")
        if not node_bin:
            self.skipTest("node binary not found on system")

        script = f"""
        const fs = require('fs');
        const prismCode = fs.readFileSync({repr(str(PRISM_JS))}, 'utf8');
        eval(prismCode); // defines global.Prism

        const pyCode = 'def greet(name):\\n    return "hello " + name';
        const highlighted = Prism.highlight(pyCode, Prism.languages.python, 'python');
        if (!highlighted.includes('class="token keyword"') && !highlighted.includes("class='token keyword'")) {{
            console.error('Python keyword token not found in: ' + highlighted);
            process.exit(1);
        }}
        if (!highlighted.includes('class="token string"') && !highlighted.includes("class='token string'")) {{
            console.error('Python string token not found in: ' + highlighted);
            process.exit(1);
        }}
        console.log('PASS');
        """
        res = subprocess.run([node_bin, "-e", script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Prism node test failed:\n{res.stderr}")
        self.assertIn("PASS", res.stdout)


if __name__ == "__main__":
    unittest.main()
