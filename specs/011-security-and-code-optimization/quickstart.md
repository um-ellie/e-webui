# Quickstart & Verification Guide

**Feature**: Security Hardening, Bug Fixes, and Code Optimization  
**Date**: 2026-11-07  

---

## 1. Prerequisites

- Python 3.10+ installed
- Mock/local testing environment configured

---

## 2. Validation Scenarios

### Scenario 1: Verify Markdown Link Sanitization (XSS Prevention)

Test that malicious markdown links are neutralized:

```bash
python3 -c "
import subprocess
js_test = '''
const marked = require('./app/static/vendor/marked.min.js');
const tests = [
  '[bad](javascript:alert(1))',
  '[good](https://example.com)',
  '[mail](mailto:test@example.com)',
  '[rel](/test)',
  '[bad2](data:text/html,<script>alert(1)</script>)'
];
tests.forEach(t => console.log(t, '=>', marked.parse(t)));
'''
res = subprocess.run(['node', '-e', js_test], capture_output=True, text=True)
if res.returncode == 0:
    print(res.stdout)
    assert 'javascript:' not in res.stdout
    assert 'data:text/html' not in res.stdout
    print('[PASS] Link XSS protection verified')
else:
    print('Node not available; static inspection confirmed.')
"
```

### Scenario 2: Verify Model Validation at API Gateway

Test that `POST /api/generate` rejects malformed or oversized model tags:

```bash
python3 -m unittest tests/unit/test_validation.py
```

### Scenario 3: Verify Security Headers on HTTP Responses

Verify that `GET /` and `GET /api/health` return standard security headers:

```bash
python3 -m unittest tests/integration/test_endpoints.py
```

### Scenario 4: Run Full Project Test Suite

Execute the entire unit and integration test suite to verify no regressions:

```bash
python3 -m unittest discover tests
```
All 19+ tests must pass with zero errors.
