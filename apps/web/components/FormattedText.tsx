"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`b${i}`}>{token.slice(2, -2)}</strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <Box component="span" key={`c${i}`} sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9em" }}>
          {token.slice(1, -1)}
        </Box>
      );
    } else {
      nodes.push(
        <em key={`i${i}`}>{token.slice(1, -1)}</em>
      );
    }
    i += 1;
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function FormattedText({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lines = trimmed.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    const body = para.join(" ").trim();
    para = [];
    if (!body) return;
    blocks.push(
      <Typography key={`p${key++}`} variant="body2" sx={{ mb: 1, lineHeight: 1.7 }}>
        {renderInline(body)}
      </Typography>
    );
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <Box key={`ul${key++}`} component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5 }}>
        {list.map((item, idx) => (
          <Typography key={idx} component="li" variant="body2" sx={{ mb: 0.5, lineHeight: 1.7 }}>
            {renderInline(item)}
          </Typography>
        ))}
      </Box>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushPara();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
      flushPara();
      const variant = heading[1].length === 1 ? "h6" : heading[1].length === 2 ? "subtitle1" : "subtitle2";
      blocks.push(
        <Typography key={`h${key++}`} variant={variant} sx={{ mt: 1, mb: 0.75, fontWeight: 600 }}>
          {renderInline(heading[2])}
        </Typography>
      );
      continue;
    }
    if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      flushPara();
      list.push(stripBullet(line));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushList();
  flushPara();

  return <Box>{blocks}</Box>;
}

export function formatPlainItem(item: string): string {
  return stripBullet(item).replace(/^\*+|\*+$/g, "").trim();
}

export function InlineFormatted({ text }: { text: string }) {
  const cleaned = formatPlainItem(text);
  if (!cleaned) return null;
  return <>{renderInline(cleaned)}</>;
}
