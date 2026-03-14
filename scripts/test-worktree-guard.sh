#!/bin/bash
# scripts/test-worktree-guard.sh — Verify .githooks/pre-commit worktree guard
#
# Creates a temporary git repo, simulates primary-repo and worktree scenarios,
# and asserts the hook blocks/allows commits correctly.
#
# Usage: bash scripts/test-worktree-guard.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_SRC="$SCRIPT_DIR/../.githooks/pre-commit"

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "FAIL: Hook not found at $HOOK_SRC"
  exit 1
fi

PASS=0
FAIL=0
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

log_pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
log_fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }

# ── Setup: create a temp git repo ─────────────────────────────
REPO="$TMPDIR/test-repo"
git init "$REPO" --quiet
cd "$REPO"
git config user.email "test@test.com"
git config user.name "Test"

# Copy hook
mkdir -p .githooks
cp "$HOOK_SRC" .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks

# Initial commit on main
echo "init" > README.md
git add README.md
git commit -m "init" --quiet

echo ""
echo "=== Worktree Guard Tests ==="
echo ""

# ── Test 1: Feature branch in primary repo → BLOCKED ─────────
echo "[Test 1] Feature branch commit in primary repo — should BLOCK"
git checkout -b feat/test-feature --quiet
echo "change" > test.txt
git add test.txt

if git commit -m "should fail" --quiet 2>/dev/null; then
  log_fail "commit succeeded but should have been blocked"
else
  log_pass "commit blocked as expected"
fi

# Clean up
git reset HEAD test.txt --quiet 2>/dev/null || true
git checkout main --quiet
git branch -D feat/test-feature --quiet 2>/dev/null || true

# ── Test 2: main branch in primary repo → ALLOWED ────────────
echo "[Test 2] main branch commit in primary repo — should ALLOW"
echo "change on main" > main-change.txt
git add main-change.txt

if git commit -m "allowed on main" --quiet 2>/dev/null; then
  log_pass "commit on main allowed"
else
  log_fail "commit on main was blocked"
fi

# ── Test 3: Feature branch in worktree → ALLOWED ─────────────
echo "[Test 3] Feature branch commit in worktree — should ALLOW"
WORKTREE="$TMPDIR/test-worktree"
git worktree add "$WORKTREE" -b feat/worktree-test --quiet
cd "$WORKTREE"

# Worktree inherits core.hooksPath from main repo config
echo "worktree change" > wt-file.txt
git add wt-file.txt

if git commit -m "allowed in worktree" --quiet 2>/dev/null; then
  log_pass "commit in worktree allowed"
else
  log_fail "commit in worktree was blocked"
fi

cd "$REPO"

# ── Test 4: Override with SKIP_WORKTREE_CHECK=1 → ALLOWED ────
echo "[Test 4] Feature branch in primary repo with override — should ALLOW"
git checkout -b feat/override-test --quiet
echo "override" > override.txt
git add override.txt

if SKIP_WORKTREE_CHECK=1 git commit -m "override allowed" --quiet 2>/dev/null; then
  log_pass "override commit allowed"
else
  log_fail "override commit was blocked"
fi

git checkout main --quiet

# ── Test 5: Shared-state file on non-main branch → BLOCKED ───
echo "[Test 5] Shared-state file on feature branch — should BLOCK"
git checkout -b feat/shared-state-test --quiet 2>/dev/null || git checkout feat/shared-state-test --quiet
# Need override for worktree guard to test shared-state guard
mkdir -p docs
echo "backlog" > docs/BACKLOG.md
git add docs/BACKLOG.md

if SKIP_WORKTREE_CHECK=1 git commit -m "shared state should fail" --quiet 2>/dev/null; then
  log_fail "shared-state commit succeeded but should have been blocked"
else
  log_pass "shared-state commit blocked on feature branch"
fi

git reset HEAD docs/BACKLOG.md --quiet 2>/dev/null || true
git checkout main --quiet

# ── Test 6: Shared-state file on main → ALLOWED ──────────────
echo "[Test 6] Shared-state file on main — should ALLOW"
mkdir -p docs
echo "backlog on main" > docs/BACKLOG.md
git add docs/BACKLOG.md

if git commit -m "shared state on main" --quiet 2>/dev/null; then
  log_pass "shared-state commit on main allowed"
else
  log_fail "shared-state commit on main was blocked"
fi

# ── Test 7: runtime/* branch in primary repo → ALLOWED ───────
echo "[Test 7] runtime/* branch in primary repo — should ALLOW"
git checkout -b runtime/test-sync --quiet
echo "runtime" > runtime-file.txt
git add runtime-file.txt

if git commit -m "runtime branch ok" --quiet 2>/dev/null; then
  log_pass "runtime branch commit allowed"
else
  log_fail "runtime branch commit was blocked"
fi

git checkout main --quiet

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [[ $FAIL -gt 0 ]]; then
  echo "SOME TESTS FAILED"
  exit 1
else
  echo "ALL TESTS PASSED"
  exit 0
fi
