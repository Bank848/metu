#!/usr/bin/env bash
# Phase 38 - one-shot commit history cleanup runner.
#
# Run this ONCE on your machine to apply the subject-only rewrite to
# every commit on main. Sandbox (Claude) cannot run destructive
# history rewrites - this script bundles all the safety steps so you
# just copy-paste one command.
#
# Usage:
#   bash scripts/run-commit-cleanup.sh
#
# What it does:
#   1. Verifies the safety tag exists (creates if missing).
#   2. Shows preview - what would change.
#   3. Asks for explicit "YES" to proceed.
#   4. Runs git filter-repo with the subject-only callback.
#   5. Verifies the new log looks right.
#   6. Asks for explicit "YES" before force-pushing.
#
# Rollback if something looks wrong AFTER running:
#   git reset --hard pre-commit-cleanup-2026-04-30
#   git push --force-with-lease origin main

set -e

cd "$(dirname "$0")/.."

GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
DIM='\033[2m'
NC='\033[0m'

echo -e "${GREEN}=== Phase 38 commit history cleanup ===${NC}"

# 1. Tag backup
if git rev-parse pre-commit-cleanup-2026-04-30 >/dev/null 2>&1; then
  echo "✓ Backup tag exists: pre-commit-cleanup-2026-04-30"
else
  echo "  Creating backup tag..."
  git tag pre-commit-cleanup-2026-04-30 main
  git push origin pre-commit-cleanup-2026-04-30
  echo "✓ Backup tag created + pushed"
fi

# 2. Preview
echo ""
echo -e "${YELLOW}=== Preview (first 5 commits that will change) ===${NC}"
node scripts/preview-commit-cleanup.mjs --changed-only --limit 5

echo ""
echo -e "${YELLOW}Total summary:${NC}"
node scripts/preview-commit-cleanup.mjs 2>&1 | tail -1

# 3. Confirm rewrite
echo ""
echo -e "${RED}This rewrites every commit's SHA on main.${NC}"
echo -e "${DIM}AuthorDate + CommitDate are preserved (your timestamps don't shift).${NC}"
echo -e "${DIM}Code is untouched - only commit messages change.${NC}"
echo ""
read -r -p "Type YES to run filter-repo: " confirm
if [ "$confirm" != "YES" ]; then
  echo "Aborted."
  exit 0
fi

# 4. Run rewrite
echo ""
echo "Running git filter-repo..."
git filter-repo --commit-callback "$(cat scripts/cleanup-commit-messages.py)" --force

# 5. Verify
echo ""
echo -e "${GREEN}=== After rewrite (top 10 commits) ===${NC}"
git log --oneline | head -10
echo ""
echo "If anything looks wrong, rollback with:"
echo "  git reset --hard pre-commit-cleanup-2026-04-30"
echo ""

# 6. Confirm push
read -r -p "Type YES to force-push to origin/main: " confirm2
if [ "$confirm2" != "YES" ]; then
  echo "Local rewrite kept. Push later with: git push --force-with-lease origin main"
  exit 0
fi

git push --force-with-lease origin main

echo -e "${GREEN}✓ Done. History rewritten + pushed.${NC}"
