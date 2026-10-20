#!/usr/bin/env bash
# Publish a tested PostgreSQL release. First SQLite cutover is a separate rehearsed operation.
set -euo pipefail
release_id="${1:?release id required}"
hostname="${2:?hostname required}"
[[ "$release_id" =~ ^[a-zA-Z0-9-]+$ ]] && [[ "$hostname" =~ ^[a-zA-Z0-9.-]+$ ]]
base=/opt/fullstack-toolkit
runtime="$base/shared/saas.env"
test -f "$runtime"
test -f "$base/shared/saas-migration-verified.json" || { echo 'First SQLite migration must be rehearsed and reconciled before automatic SaaS releases'; exit 1; }
release="$base/releases/$release_id"
test ! -e "$release"
install -d -m 700 "$base/releases" "$base/backups"
mkdir "$release"
tar -xzf "/tmp/toolkit-$release_id.tgz" -C "$release"
export RELEASE_TAG="$release_id"
compose=(docker compose --project-name fullstack-toolkit --env-file "$runtime" -f "$release/docker/compose.saas.yml")
"${compose[@]}" config --quiet
previous="$(readlink -f "$base/current")"
test -f "$previous/docker/compose.saas.yml" || { echo 'Legacy cutover requires the first-migration runbook'; exit 1; }
previous_tag="$(basename "$previous")"
before="$(find "$previous/packages/db/prisma/migrations" -type f -exec sha256sum {} + | sed "s|$previous/||" | sort | sha256sum | cut -d' ' -f1)"
after="$(find "$release/packages/db/prisma/migrations" -type f -exec sha256sum {} + | sed "s|$release/||" | sort | sha256sum | cut -d' ' -f1)"
"${compose[@]}" build api
"${compose[@]}" build migrate
"${compose[@]}" build web
umask 077
docker exec fullstack-toolkit-postgres-1 pg_dump -U postgres -d toolkit -Fc > "$base/backups/before-$release_id.dump"
test -s "$base/backups/before-$release_id.dump"
rollback() {
  echo 'Release failed; all source/images/data retained.'
  if test "$before" = "$after"; then
    RELEASE_TAG="$previous_tag" docker compose --project-name fullstack-toolkit --env-file "$runtime" -f "$previous/docker/compose.saas.yml" up -d --no-build --no-deps api web
    echo 'Compatible application rollback performed; investigate and run browser acceptance.'
  else
    docker stop fullstack-toolkit-api-1 2>/dev/null || true
    echo 'Migration compatibility is unconfirmed; preserve writes and use the reviewed recovery runbook.'
  fi
}
trap rollback ERR
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --no-build --no-deps api web
for attempt in $(seq 1 60); do
 if curl -fsS http://127.0.0.1:3181/api/ready >/dev/null && curl -fsS "https://$hostname/" >/dev/null; then break; fi
 sleep 2
done
curl -fsS "https://$hostname/api/ready"
curl -fsS -o /dev/null "https://$hostname/"
python3 - "$runtime" "$release_id" <<'PY'
import pathlib,sys,os
p=pathlib.Path(sys.argv[1]);tag=sys.argv[2]
text='\n'.join(line for line in p.read_text().splitlines() if not line.startswith('RELEASE_TAG='))+'\nRELEASE_TAG='+tag+'\n'
temp=p.with_name(p.name+'.next');temp.write_text(text);temp.chmod(0o600);os.replace(temp,p)
snapshot=p.with_name(tag+'.env');snapshot.write_text(text);snapshot.chmod(0o600)
PY
ln -sfn "$release" "$base/current"
trap - ERR
echo 'Health gates passed. Public organization/business browser acceptance is still required.'
