#!/usr/bin/env bash
set -euo pipefail
umask 077

gog=${AGENT_SYSTEM_GOG:?}
folder=1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV
# The archive contains private agent state; do not upload to a shared drive or public folder.
"$gog" drive get "$folder" --fields id,mimeType,driveId,capabilities,permissions |
  jq -e --arg folder "$folder" '
    .file | .id == $folder and .mimeType == "application/vnd.google-apps.folder" and
    (.driveId | not) and .capabilities.canAddChildren == true and
    (.permissions | length > 0 and all(.[]; .type == "user"))
  ' > /dev/null

printf 'Creating agent backup\n'
created=$(openclaw agent-system backup create --json)
archive=$(jq -er '.archive | select(startswith("/"))' <<< "$created")
"$gog" drive upload "$archive" --name "${archive##*/}" --parent "$folder" --mime-type application/gzip
printf 'Backup uploaded to Google Drive\n'
rm -- "$archive"
