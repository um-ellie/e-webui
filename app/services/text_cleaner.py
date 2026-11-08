"""Text cleaning and normalization for speech synthesis."""

import re

# Regex matching fenced code blocks (```...```) including multiline and optional language tag
FENCED_CODE_BLOCK_REGEX = re.compile(r"```[\w\-]*\s*[\s\S]*?(?:```|\Z)")

# Regex matching inline code `...`
INLINE_CODE_REGEX = re.compile(r"`([^`]+)`")

# Regex matching markdown hyperlinks: [anchor](url) -> anchor
MARKDOWN_LINK_REGEX = re.compile(r"\[([^\]]+)\]\([^\)]+\)")

# Regex matching raw standalone URLs
RAW_URL_REGEX = re.compile(r"https?://\S+")

# Markdown syntax characters to remove/simplify
MARKDOWN_HEADER_REGEX = re.compile(r"^#{1,6}\s+", re.MULTILINE)
MARKDOWN_BLOCKQUOTE_REGEX = re.compile(r"^>\s*", re.MULTILINE)
MARKDOWN_HORIZONTAL_RULE_REGEX = re.compile(r"^[-*_]{3,}\s*$", re.MULTILINE)
MARKDOWN_LIST_BULLET_REGEX = re.compile(r"^(\s*)[-*+]\s+", re.MULTILINE)
MARKDOWN_NUMBERED_LIST_REGEX = re.compile(r"^(\s*)\d+\.\s+", re.MULTILINE)

# Emphasis: bold and italic (**text**, *text*, __text__, _text_, ~~strikethrough~~)
MARKDOWN_BOLD_ITALIC_REGEX = re.compile(r"(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(~~)(.*?)\5")

# Table formatting pipes and separator rows
TABLE_SEPARATOR_ROW_REGEX = re.compile(r"^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$", re.MULTILINE)
TABLE_PIPE_REGEX = re.compile(r"\|")

# Emoji and pictograph unicode ranges
EMOJI_REGEX = re.compile(
    r"[\U00010000-\U0010ffff]|"
    r"[\u2600-\u27bf]|"
    r"[\u2300-\u23ff]|"
    r"[\u2b50-\u2b55]|"
    r"[\ufe00-\ufe0f]|"
    r"\u200d"
)

# Speakable Latin content detection: contains at least one English letter [a-zA-Z]
SPEAKABLE_LATIN_REGEX = re.compile(r"[a-zA-Z]")


def clean_text(text: str) -> str:
    """Cleans and normalizes assistant markdown text into natural speakable prose.

    - Completely removes fenced code blocks.
    - Strips inline backticks, preserving enclosed text.
    - Preserves link anchor text while stripping target URLs.
    - Removes raw URLs, markdown headers, blockquotes, bullets, and emojis.
    - Collapses multiple whitespace characters.
    """
    if not text:
        return ""

    # 1. Remove entire fenced code blocks
    cleaned = FENCED_CODE_BLOCK_REGEX.sub(" ", text)

    # 2. Extract anchor text from markdown links before removing URLs
    cleaned = MARKDOWN_LINK_REGEX.sub(r"\1", cleaned)

    # 3. Remove raw URLs
    cleaned = RAW_URL_REGEX.sub(" ", cleaned)

    # 4. Remove inline code backticks while preserving the text inside
    cleaned = INLINE_CODE_REGEX.sub(r"\1", cleaned)

    # 5. Remove markdown block structures
    cleaned = MARKDOWN_HEADER_REGEX.sub("", cleaned)
    cleaned = MARKDOWN_BLOCKQUOTE_REGEX.sub("", cleaned)
    cleaned = MARKDOWN_HORIZONTAL_RULE_REGEX.sub(" ", cleaned)
    cleaned = MARKDOWN_LIST_BULLET_REGEX.sub(r"\1", cleaned)
    cleaned = MARKDOWN_NUMBERED_LIST_REGEX.sub(r"\1", cleaned)

    # 6. Simplify bold / italic / strikethrough: keep inner captured group
    # Loop to handle nested formatting if any
    for _ in range(2):
        cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
        cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
        cleaned = re.sub(r"\*(.*?)\*", r"\1", cleaned)
        cleaned = re.sub(r"_(.*?)_", r"\1", cleaned)
        cleaned = re.sub(r"~~(.*?)~~", r"\1", cleaned)

    # 7. Remove markdown tables
    cleaned = TABLE_SEPARATOR_ROW_REGEX.sub(" ", cleaned)
    cleaned = TABLE_PIPE_REGEX.sub(" ", cleaned)

    # 8. Remove emojis and decorative symbols
    cleaned = EMOJI_REGEX.sub("", cleaned)

    # 9. Normalize whitespace and sentence spacing
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned


def has_speakable_content(text: str) -> bool:
    """Returns True if the text contains at least one speakable English letter after cleaning."""
    cleaned = clean_text(text)
    return bool(SPEAKABLE_LATIN_REGEX.search(cleaned))
