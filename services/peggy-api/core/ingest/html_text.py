"""Extract visible text from an HTML upload. Markup and scripts are discarded."""

from __future__ import annotations

import re
from html.parser import HTMLParser

_SKIP_TAGS = {"script", "style", "noscript"}
_BREAK_TAGS = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "section", "article"}


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _SKIP_TAGS:
            self._skip += 1
        elif tag in _BREAK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS and self._skip:
            self._skip -= 1
        elif tag in _BREAK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        text = data.strip()
        if text:
            self.parts.append(text + " ")


def is_html(filename: str | None, content_type: str | None) -> bool:
    if content_type and "html" in content_type.lower():
        return True
    name = (filename or "").lower()
    return name.endswith(".html") or name.endswith(".htm")


def extract_text_from_html(data: bytes) -> str:
    raw = data.decode("utf-8", errors="replace")
    parser = _VisibleTextParser()
    parser.feed(raw)
    parser.close()
    text = "".join(parser.parts)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
