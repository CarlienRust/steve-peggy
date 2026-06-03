#!/usr/bin/env python3
"""Upload all PDFs from test_pdfs/ (or a given folder) to the local Peggy API.

Uses only the Python standard library — no pip install needed.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = REPO_ROOT / "test_pdfs"


def upload_pdf(api_url: str, path: Path) -> dict:
    boundary = "----peggyIngestBoundary"
    file_bytes = path.read_bytes()
    parts: list[bytes] = []

    def field(name: str, value: str) -> None:
        parts.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode()
        )

    field("title", path.stem)
    field("source_type", "literature")
    parts.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: application/pdf\r\n\r\n".encode()
    )
    parts.append(file_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/ingest/upload",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest local PDFs into Peggy")
    p.add_argument("--api", default="http://localhost:8000", help="peggy-api base URL")
    p.add_argument(
        "folder",
        nargs="?",
        default=str(DEFAULT_DIR),
        help=f"Folder of PDFs (default: {DEFAULT_DIR})",
    )
    args = p.parse_args()
    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"Not a directory: {folder}", file=sys.stderr)
        return 1

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs in {folder}", file=sys.stderr)
        return 1

    print(f"API: {args.api}")
    print(f"Found {len(pdfs)} PDF(s) in {folder}\n")

    ok = 0
    for pdf in pdfs:
        try:
            result = upload_pdf(args.api, pdf)
            print(f"OK  {pdf.name} -> {result.get('chunks', '?')} chunks")
            ok += 1
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:200]
            print(f"ERR {pdf.name} -> HTTP {e.code}: {detail}")
        except urllib.error.URLError as e:
            print(f"ERR {pdf.name} -> {e.reason}")
            print("     Is the API running? ./scripts/start-api.sh", file=sys.stderr)
        except Exception as e:
            print(f"ERR {pdf.name} -> {e}")

    print(f"\nDone: {ok}/{len(pdfs)} succeeded")
    return 0 if ok == len(pdfs) else 1


if __name__ == "__main__":
    sys.exit(main())
