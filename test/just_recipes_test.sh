#!/usr/bin/env bash
# Finite smoke tests for just run / repl / watch. Watch is wrapped in timeout
# so validation cannot hang on entr.
set -euo pipefail
shopt -s inherit_errexit

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

fail() {
	printf 'FAIL: %s\n' "$1" >&2
	exit 1
}

listed="$(just --list)"
printf '%s\n' "$listed" | grep -q 'run ' || fail "just --list missing run"
printf '%s\n' "$listed" | grep -q 'watch ' || fail "just --list missing watch"
printf '%s\n' "$listed" | grep -q 'repl' || fail "just --list missing repl"

run_out="$(just run demo.pattern)"
printf '%s\n' "$run_out" | grep -q '12 :: Float' ||
	fail "just run demo.pattern unexpected output: $run_out"

parse_out="$(just run demo.pattern --parse)"
printf '%s\n' "$parse_out" | grep -q 'def Rectangle' ||
	fail "just run demo.pattern --parse unexpected output: $parse_out"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp demo.pattern "$tmp/demo file.pattern"
space_out="$(just run "$tmp/demo file.pattern")"
printf '%s\n' "$space_out" | grep -q '12 :: Float' ||
	fail "just run with a spaced filename failed: $space_out"

repl_out="$(printf ':Widget\n\n:quit\n' | just repl)"
printf '%s\n' "$repl_out" | grep -q 'Widget :: TitleCaseSymbol' ||
	fail "just repl unexpected output: $repl_out"

command -v timeout >/dev/null || fail "timeout is required for watch smoke tests"
command -v entr >/dev/null || fail "entr is required for watch smoke tests"

set +e
watch_out="$(timeout -k 2 12s just watch demo.pattern 2>&1)"
watch_status=$?
set -e
printf '%s\n' "$watch_out" | grep -q '12 :: Float' ||
	fail "just watch did not run FILE (status $watch_status): $watch_out"
case "$watch_status" in
124 | 137 | 143 | 0) ;;
*)
	fail "just watch exited $watch_status: $watch_out"
	;;
esac

printf 'just run/repl/watch smoke tests passed\n'
