#!/usr/bin/env bash
# Cheap drift check: .cursor/Dockerfile must mention each string-pinned
# package name from devbox.json. Node comes from the node:* base image.
set -euo pipefail
shopt -s inherit_errexit

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
devbox="$project_root/devbox.json"
dockerfile="$project_root/.cursor/Dockerfile"

fail() {
	printf 'FAIL: %s\n' "$1" >&2
	exit 1
}

[[ -f "$devbox" ]] || fail "devbox.json is missing"
[[ -f "$dockerfile" ]] || fail ".cursor/Dockerfile is missing"

grep -qE '^FROM node:' "$dockerfile" ||
	fail ".cursor/Dockerfile must keep a node: base image"

if grep -qE '^(FROM|RUN|ENV|COPY|ADD).*(\bnix\b|devbox|direnv)' "$dockerfile"; then
	fail ".cursor/Dockerfile must not install nix, devbox, or direnv"
fi

missing=()
while IFS= read -r name; do
	[[ -n "$name" ]] || continue
	if ! grep -qF "$name" "$dockerfile"; then
		missing+=("$name")
	fi
done < <(sed -nE 's/^[[:space:]]*"([a-z0-9-]+)":[[:space:]]*"[^"]+".*/\1/p' "$devbox")

if ((${#missing[@]} > 0)); then
	fail "Dockerfile does not mention devbox.json packages: ${missing[*]}"
fi

printf 'cursor Dockerfile mentions every string-pinned devbox.json package\n'
