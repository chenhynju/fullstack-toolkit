#!/usr/bin/env bash
# Execute from stdin on the server (GitHub workflow) or as a local source file.
set -euo pipefail
release_id="${1:?release id required}"
hostname="${2:?hostname required}"
[[ "$release_id" =~ ^[a-zA-Z0-9-]+$ ]] && [[ "$hostname" =~ ^[a-zA-Z0-9.-]+$ ]]
base=/opt/fullstack-toolkit
test -f "$base/shared/saas.env"
test -f "$base/shared/saas-migration-verified.json" || { echo 'First SQLite migration is not approved; no service changed'; exit 1; }
test -f "/tmp/toolkit-$release_id.tgz"
# Extract only the reviewed release script to a private temporary file.
umask 077
temporary="$(mktemp "$base/shared/release-entry.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
tar -xOf "/tmp/toolkit-$release_id.tgz" scripts/release-saas.sh > "$temporary"
bash "$temporary" "$release_id" "$hostname"
