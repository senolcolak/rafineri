#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git not found; skipping hooks install"
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "not a git repository; skipping hooks install"
  exit 0
fi

git config core.hooksPath .githooks

if [ -f .githooks/pre-commit ]; then
  chmod +x .githooks/pre-commit
fi
if [ -f .githooks/pre-push ]; then
  chmod +x .githooks/pre-push
fi

echo "Configured git hooks path: .githooks"
