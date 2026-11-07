# Cursor cloud agent image. glibc >= 2.38 (trixie) so commit signing works.
# Tools match local devbox package names: nodejs, just, jq, git, bash, curl,
# shellcheck, coreutils, entr. No nix, devbox, or direnv.
#
# Base digest is the linux multi-arch index for node:24-trixie-slim
# (Docker Hub tag digest, last_updated 2026-11-05).

FROM node:24-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d

USER root

ARG TARGETARCH

ENV TZ=America/Denver

# nodejs comes from the base image. Distro packages cover git, bash, jq, curl,
# shellcheck, entr, tzdata, ca-certificates. coreutils is Essential on Debian.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    coreutils \
    curl \
    entr \
    git \
    jq \
    shellcheck \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# just: sha256 values are GitHub release-asset digests for
# just-1.58.0-{x86_64,aarch64}-unknown-linux-musl.tar.gz
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) just_arch=x86_64; just_sha256=4a5cc2f53e6f0f8c59092a6cc38291eb729d46a7dd95d3ae582008881b84931d ;; \
      arm64) just_arch=aarch64; just_sha256=748237128c4c40cbdabc65e841d05ceba13cc23a91eaba395495894c1d9764df ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/just.tgz \
      "https://github.com/casey/just/releases/download/1.58.0/just-1.58.0-${just_arch}-unknown-linux-musl.tar.gz"; \
    echo "${just_sha256}  /tmp/just.tgz" | sha256sum -c -; \
    tar -xzf /tmp/just.tgz -C /usr/local/bin just; \
    rm -f /tmp/just.tgz

RUN command -v node && command -v npm && \
    command -v just && command -v git && command -v bash && \
    command -v jq && command -v curl && command -v shellcheck && \
    command -v entr && command -v cat && \
    test -f /usr/share/zoneinfo/America/Denver && \
    node --version && just --version
