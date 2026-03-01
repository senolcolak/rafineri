#!/bin/bash
# =============================================================================
# Generate pnpm-lock.yaml for Reproducible Builds
# =============================================================================
# Run this script locally (not on server) to generate a lockfile
# that should be committed to version control for production builds
# =============================================================================

set -e

echo "=== Generating pnpm-lock.yaml ==="
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "ERROR: pnpm is not installed!"
    echo "Install it: npm install -g pnpm"
    exit 1
fi

echo "[1/3] Installing dependencies and generating lockfile..."
pnpm install

echo ""
echo "[2/3] Verifying lockfile was created..."
if [ -f "pnpm-lock.yaml" ]; then
    echo "✓ pnpm-lock.yaml created successfully"
    ls -lh pnpm-lock.yaml
else
    echo "✗ pnpm-lock.yaml not found!"
    exit 1
fi

echo ""
echo "[3/3] Done!"
echo ""
echo "Next steps:"
echo "  1. Review the lockfile: git diff pnpm-lock.yaml"
echo "  2. Commit it: git add pnpm-lock.yaml && git commit -m 'Add pnpm lockfile'"
echo "  3. Push: git push"
echo "  4. On your server, pull and rebuild:"
echo "       git pull"
echo "       docker compose -f docker-compose.server.yml up -d --build"
echo ""
