#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ $# == 0 ]]; then
  exec bun "$(dirname "$0")/backup-agent-lock.js"
fi
[[ $# == 1 && $1 == --locked && -e /dev/fd/3 ]] || exit 1
: "${AGENT_SYSTEM_GOG:?run through the bound Agent System automation}"
folder=1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV
stage=create
delivered=false
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
trap 'if $delivered; then echo "delivery succeeded / cleanup failed ($stage)" >&2; else echo "backup failed ($stage); local archives retained" >&2; fi' ERR

drive() { "$AGENT_SYSTEM_GOG" drive "$@"; }

stage=destination
drive get "$folder" --fields id,mimeType,driveId,capabilities,permissions > "$scratch/folder"
jq -e --arg folder "$folder" '
  .file | .id == $folder and .mimeType == "application/vnd.google-apps.folder" and
  (.driveId | not) and .capabilities.canAddChildren == true and
  (.permissions | length > 0 and all(.[]; .type == "user"))
' "$scratch/folder" > /dev/null

stage=create
openclaw agent-system backup create --json > "$scratch/created"
archive=$(jq -er '.archive' "$scratch/created")
output=$(jq -er '.settings.output' "$scratch/created")
# The owning command verified contents. Check only the path/name used by our rename and cleanup.
uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
stamp='[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z'
reserved="^emori-nightly-$stamp-$uuid\\.tar\\.gz$"
name=${archive##*/}
[[ $output == /* && $(dirname "$archive") == "$output" && -d $output && ! -L $output ]]
[[ $name =~ ^emori-$stamp-$uuid\.tar\.gz$ && -f $archive && ! -L $archive ]]
nightly="$output/emori-nightly-${name#emori-}"
[[ ! -e $nightly && ! -L $nightly ]]
mv "$archive" "$nightly"

stage=upload
drive upload "$nightly" --name "${nightly##*/}" --parent "$folder" --mime-type application/gzip > /dev/null
delivered=true

stage=local-cleanup
# No recursion and no link traversal. The reserved namespace deliberately owns failed-upload leftovers.
for path in "$output"/emori-nightly-*.tar.gz; do
  [[ ${path##*/} =~ $reserved && -f $path && ! -L $path ]] || continue
  rm -- "$path"
done

stage=remote-retention
page=''
printf '[]\n' > "$scratch/files"
for ((count=0; count<100; count++)); do
  args=(ls --parent "$folder" --query 'trashed = false' --max 100 --fields files\(id,name\),nextPageToken,incompleteSearch)
  [[ -z $page ]] || args+=(--page "$page")
  drive "${args[@]}" > "$scratch/page"
  jq -e '.incompleteSearch != true and (.files | type == "array" and all(.[]; (.id | type == "string") and (.name | type == "string"))) and (.has_more | type == "boolean") and (.nextPageToken | type == "string") and (.has_more == (.nextPageToken != ""))' "$scratch/page" > /dev/null
  jq -s '.[0] + .[1].files' "$scratch/files" "$scratch/page" > "$scratch/next"
  mv "$scratch/next" "$scratch/files"
  next=$(jq -r '.nextPageToken // empty' "$scratch/page")
  [[ -n $next ]] || break
  [[ $next != "$page" ]]
  page=$next
done
[[ $count -lt 100 ]]
jq -r --arg pattern "$reserved" '
  if (map(.id) | unique | length) != length then error("duplicate file ids") else
  map(select(.name | test($pattern))) | sort_by(.name, .id) | reverse | .[5:] |
  .[] | .id | if test("^[a-zA-Z0-9_-]+$") then . else error("invalid file id") end end
' "$scratch/files" > "$scratch/delete"
while IFS= read -r id; do
  drive delete "$id" --force > /dev/null
done < "$scratch/delete"
printf 'delivery succeeded / cleanup completed\n'
