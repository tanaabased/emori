#!/usr/bin/env bash
set -euo pipefail
umask 077

source "${BASH_SOURCE[0]%/*}/maintenance-report.sh"

report_backup() {
  local result=$1
  if [ "$result" -eq 0 ]; then
    maintenance_report backup-agent 'BACKUP AGENT' "$result" 'Backup uploaded to Google Drive.'
  else
    maintenance_report backup-agent 'BACKUP AGENT' "$result" "Backup command failed. Exit $result."
  fi
}

trap 'result=$?; report_backup "$result" || :; exit "$result"' EXIT

gog=${AGENT_SYSTEM_GOG:?}
folder=1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV
# The archive contains private agent state; do not upload to a shared drive or public folder.
"$gog" drive get "$folder" --fields id,mimeType,driveId,capabilities,permissions |
  jq -e --arg folder "$folder" '
    .file | .id == $folder and .mimeType == "application/vnd.google-apps.folder" and
    (.driveId | not) and .capabilities.canAddChildren == true and
    (.permissions | length > 0 and all(.[]; .type == "user"))
  ' > /dev/null

printf 'Creating agent backup\n' >&2
created=$(openclaw agent-system backup create --json)
archive=$(jq -er '.archive | select(startswith("/"))' <<< "$created")
"$gog" drive upload "$archive" --name "${archive##*/}" --parent "$folder" --mime-type application/gzip >&2
printf 'Backup uploaded to Google Drive\n' >&2
rm -- "$archive"
