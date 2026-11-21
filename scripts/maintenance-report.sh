maintenance_report() {
  local id=$1 title=$2 result=$3 body
  shift 3
  if [ "$result" -eq 0 ]; then
    title="✅ $title · RUN RESULTS"
  else
    title="❌ $title · RUN FAILED"
  fi
  body=$(printf '> ## %s\n>\n> **Agent:** EMORI\n>\n' "$title"
    printf '> %s\n' "$@")
  jq -cn --arg id "$id" --arg body "$body" \
    '{schema:"agent-system.report",version:1,cards:[{id:$id,format:"markdown",body:$body}]}'
}
