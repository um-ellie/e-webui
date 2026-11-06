# Quickstart & Verification Guide: README & .gitignore Modernization

**Feature**: `010-update-readme-gitignore`
**Date**: 2026-11-07

---

## 1. Prerequisites

- Python 3.8+ installed on the host machine.
- Git repository cloned and checked out at feature branch `010-update-readme-gitignore`.

---

## 2. Validation Scenario 1: Zero-Emoji Enforcement in README

Execute a Python character scanner to verify that zero emoji or decorative pictograph characters exist in `README.md`:

```bash
python3 -c "
with open('README.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Whitelisted technical diagram symbols
diagram_symbols = {'│', '▼', '─', '└', '├', '┌', '┐', '┘', '┴', '┬', '┼'}

# Scan for emoji-range characters outside standard Persian/Arabic blocks
detected = [
    (i + 1, c, hex(ord(c)))
    for i, c in enumerate(text)
    if ord(c) > 0x2300
    and not (0x0600 <= ord(c) <= 0x06FF)
    and c not in diagram_symbols
]

if detected:
    print(f'FAILURE: Found {len(detected)} disallowed emoji characters: {detected[:10]}')
    exit(1)
else:
    print('PASS: Zero emojis detected in README.md.')
"
```

**Expected Outcome**:
```text
PASS: Zero emojis detected in README.md.
```

---

## 3. Validation Scenario 2: Bilingual Ordering & Navigation Verification

Validate that the English section appears first and that bidirectional anchor links function properly:

```bash
python3 -c "
with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

en_pos = content.find('# English')
fa_pos = content.find('# فارسی (Persian)')

assert en_pos != -1, 'English section heading missing'
assert fa_pos != -1, 'Persian section heading missing'
assert en_pos < fa_pos, f'English ({en_pos}) must appear before Persian ({fa_pos})'
assert '[English](#english)' in content, 'Navigation link to English missing'
assert '[فارسی (Persian)](#فارسی-persian)' in content, 'Navigation link to Persian missing'

print('PASS: Language ordering and bidirectional navigation links verified.')
"
```

**Expected Outcome**:
```text
PASS: Language ordering and bidirectional navigation links verified.
```

---

## 4. Validation Scenario 3: Step-by-Step Continuity Check

Verify that all five steps exist in continuous numerical order in both English and Persian sections:

```bash
python3 -c "
with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

fa_digits = ['۱', '۲', '۳', '۴', '۵']
for i, d in enumerate(fa_digits, 1):
    en_step = f'#### Step {i}:'
    fa_step = f'#### گام {d}:'
    assert en_step in content, f'Missing {en_step} in English section'
    assert fa_step in content, f'Missing {fa_step} in Persian section'

print('PASS: All 5 steps present and contiguously numbered in both languages.')
"
```

**Expected Outcome**:
```text
PASS: All 5 steps present and contiguously numbered in both languages.
```

---

## 5. Validation Scenario 4: Git Ignore Exclusion Verification

Verify that temporary release archives, cache directories, and local secrets are properly ignored:

```bash
# Test transient packaging archive
git check-ignore -v dist/releases/sample.tar.gz release.tar.gz
# Test environment file
git check-ignore -v .env .env.local
# Test cache
git check-ignore -v __pycache__/ test.pyc .pytest_cache/
```

**Expected Outcome**:
All queried paths report active matching rules in `.gitignore`.
