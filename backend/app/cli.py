from __future__ import annotations

import argparse
from pathlib import Path

from .analyzer import analyze_directory


def main() -> None:
    parser = argparse.ArgumentParser(description="Assess a local codebase")
    parser.add_argument("path", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = analyze_directory(args.path)
    payload = report.model_dump_json(indent=2)
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()

