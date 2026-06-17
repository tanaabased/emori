#!/bin/bash
set -euo pipefail
# bootstrap a macOS machine by delegating to the hosted bootbox entrypoint.
#
# examples:
#
#   $ ./boot.sh --op-token "$OP_TOKEN"
#   $ ./boot.sh --op-token "$OP_TOKEN" --ssh-key 2mh2ny4tegbi33yt3furutomzu/id_emori
#   $ ./boot.sh --op-token "$OP_TOKEN" --emori v1.0.0-beta.1
#   $ ./boot.sh --op-token "$OP_TOKEN" --tanaab v0.2.0
#   $ DEBUG=1 ./boot.sh --op-token "$OP_TOKEN" --yes
#
# option precedence: cli options override environment variables, which override defaults.
#
# run `./boot.sh --help` for more advanced usage.

MACOS_OLDEST_SUPPORTED="26.0"
REQUIRED_CURL_VERSION="7.41.0"
BOOTBOX_URL="https://bootbox.tanaab.sh/bootbox.sh"
AGENTBOX_HEALTH_SCRIPT="/opt/tanaab/agentbox/bin/health.sh"
DEFAULT_SSH_KEY="2mh2ny4tegbi33yt3furutomzu/id_emori"
DEFAULT_EMORI_SOURCE="ssh"
DEFAULT_TANAAB_SOURCE="ssh"
DEFAULT_OPENCLAW_AUTH="openai"
EMORI_REPO_SSH_URL="git@github.com:tanaabased/emori.git"
EMORI_REPO_RELEASE_BASE_URL="https://github.com/tanaabased/emori/releases/download"
EMORI_REPO_RELEASE_ARCHIVE_PREFIX="emoriplugin"
TANAAB_REPO_SSH_URL="git@github.com:tanaabased/canon.git"
TANAAB_REPO_RELEASE_BASE_URL="https://github.com/tanaabased/canon/releases/download"
TANAAB_REPO_RELEASE_ARCHIVE_PREFIX="tanaab"
TANAAB_PLUGIN_RELATIVE_TARGET="../../../../../canon"
AGENTBOX_PREPARED="0"
AGENTBOX_BREWGROUP=""
HOMEBREW_PREFIX_PATH=""

abort() {
  printf "%serror%s: %s\n" "${tty_red-}" "${tty_reset-}" "$@" >&2
  exit 1
}

abort_multi() {
  while read -r line; do
    printf "%serror%s: %s\n" "${tty_red-}" "${tty_reset-}" "${line}" >&2
  done <<< "$@"
  exit 1
}

value_enabled() {
  case "${1:-}" in
    '' | 0 | false | FALSE | False | no | NO | No | off | OFF | Off)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

source_value_disabled() {
  case "${1:-}" in
    0 | false | FALSE | False | no | NO | No | off | OFF | Off | null | NULL | Null)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

mask_secret_for_display() {
  local value="$1"
  local length="${#value}"
  local prefix_length="4"
  local suffix_length="4"
  local suffix_start

  if [[ -z "${value}" ]]; then
    printf "none"
    return 0
  fi

  if [[ "${length}" -le 4 ]]; then
    printf "****"
    return 0
  fi

  if [[ "${length}" -le 8 ]]; then
    prefix_length="2"
    suffix_length="2"
  fi

  suffix_start=$((length - suffix_length))
  printf "%s...%s" "${value:0:${prefix_length}}" "${value:${suffix_start}:${suffix_length}}"
}

trim_whitespace() {
  local value="$1"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  printf "%s" "${value}"
}

append_array_value() {
  local array_name="$1"
  local value
  local quoted

  value="$(trim_whitespace "$2")"
  if [[ -n "${value}" ]]; then
    printf -v quoted '%q' "${value}"
    eval "${array_name}+=(${quoted})"
  fi
}

append_csv_to_array() {
  local array_name="$1"
  local old_ifs="${IFS}"
  local entry
  local -a values=()

  if [[ -z "${2}" ]]; then
    return 0
  fi

  IFS=','
  read -r -a values <<< "${2}"
  IFS="${old_ifs}"

  if [[ "${#values[@]}" -eq 0 ]]; then
    return 0
  fi

  for entry in "${values[@]}"; do
    append_array_value "${array_name}" "${entry}"
  done
}

array_join() {
  local delimiter="$1"
  local array_name="$2"
  local item
  local first="1"
  local value_count="0"
  local -a values=()

  eval "value_count=\${#${array_name}[@]}"
  if [[ "${value_count}" -eq 0 ]]; then
    return 0
  fi

  eval "values=(\"\${${array_name}[@]}\")"

  for item in "${values[@]}"; do
    if [[ "${first}" == "1" ]]; then
      printf "%s" "${item}"
      first="0"
    else
      printf "%s%s" "${delimiter}" "${item}"
    fi
  done
}

chomp() {
  printf "%s" "${1/"$'\n'"/}"
}

shell_join() {
  local arg

  printf "%s" "${1:-}"
  if [[ $# -eq 0 ]]; then
    return 0
  fi

  shift

  for arg in "$@"; do
    printf " "
    printf "%s" "${arg// /\ }"
  done
}

discover_agentbox_context() {
  local brewgroup_output

  if [[ ! -e "${AGENTBOX_HEALTH_SCRIPT}" ]]; then
    AGENTBOX_PREPARED="0"
    AGENTBOX_BREWGROUP=""
    return 0
  fi

  AGENTBOX_PREPARED="1"
  AGENTBOX_BREWGROUP=""

  if [[ ! -x "${AGENTBOX_HEALTH_SCRIPT}" ]]; then
    return 0
  fi

  brewgroup_output="$("${AGENTBOX_HEALTH_SCRIPT}" --brewgroup 2>/dev/null || true)"
  brewgroup_output="$(trim_whitespace "${brewgroup_output}")"
  if value_enabled "${brewgroup_output}"; then
    AGENTBOX_BREWGROUP="${brewgroup_output}"
  fi
}

default_homebrew_prefix() {
  case "${ARCH}" in
    arm64)
      printf "/opt/homebrew"
      ;;
    *)
      printf "/usr/local"
      ;;
  esac
}

resolve_homebrew_prefix() {
  local brew_command
  local prefix

  if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
    printf "%s" "${HOMEBREW_PREFIX}"
    return 0
  fi

  brew_command="$(command -v brew || true)"
  if [[ -n "${brew_command}" ]]; then
    prefix="$("${brew_command}" --prefix 2>/dev/null || true)"
    prefix="$(trim_whitespace "${prefix}")"
    if [[ -n "${prefix}" ]]; then
      printf "%s" "${prefix}"
      return 0
    fi
  fi

  default_homebrew_prefix
}

ensure_homebrew_prefix_access() {
  local user_name

  discover_agentbox_context
  HOMEBREW_PREFIX_PATH="$(resolve_homebrew_prefix)"

  debug raw AGENTBOX_PREPARED="${AGENTBOX_PREPARED}"
  debug raw AGENTBOX_BREWGROUP="${AGENTBOX_BREWGROUP:-}"
  debug raw HOMEBREW_PREFIX="${HOMEBREW_PREFIX_PATH}"

  if [[ ! -e "${HOMEBREW_PREFIX_PATH}" ]]; then
    debug "${tty_ts}${HOMEBREW_PREFIX_PATH}${tty_reset} does not exist; bootbox may install Homebrew if needed"
    return 0
  fi

  if [[ -d "${HOMEBREW_PREFIX_PATH}" &&
    -r "${HOMEBREW_PREFIX_PATH}" &&
    -w "${HOMEBREW_PREFIX_PATH}" &&
    -x "${HOMEBREW_PREFIX_PATH}" ]]; then
    debug "${tty_ts}${HOMEBREW_PREFIX_PATH}${tty_reset} is readable, writable, and traversable"
    return 0
  fi

  user_name="$(id -un 2>/dev/null || printf "current user")"
  if [[ "${AGENTBOX_PREPARED}" == "1" && -n "${AGENTBOX_BREWGROUP}" ]]; then
    abort_multi "$(cat <<EOABORT
Homebrew prefix ${tty_ts}${HOMEBREW_PREFIX_PATH}${tty_reset} exists, but ${tty_ts}${user_name}${tty_reset} cannot read, traverse, and write it.
This appears to be an agentbox-prepared machine. Add ${tty_ts}${user_name}${tty_reset} to the Homebrew brewgroup ${tty_ts}${AGENTBOX_BREWGROUP}${tty_reset}, start a new login session, then rerun this wrapper.
EOABORT
)"
  fi

  abort_multi "$(cat <<EOABORT
Homebrew prefix ${tty_ts}${HOMEBREW_PREFIX_PATH}${tty_reset} exists, but ${tty_ts}${user_name}${tty_reset} cannot read, traverse, and write it.
Grant the invoking user read/write/traverse access to ${tty_ts}${HOMEBREW_PREFIX_PATH}${tty_reset} through agentbox or admin-owned machine prep, then rerun this wrapper.
EOABORT
)"
}

# shellcheck disable=SC2292
if [ -z "${BASH_VERSION:-}" ]; then
  abort "bash is required to interpret this script."
fi

if [[ -n "${CI-}" && -n "${INTERACTIVE-}" ]]; then
  abort "cannot run force-interactive mode in CI."
fi

# shellcheck disable=SC2016
if [[ -n "${INTERACTIVE-}" && -n "${NONINTERACTIVE-}" ]]; then
  abort 'both `$INTERACTIVE` and `$NONINTERACTIVE` are set. please unset at least one variable and try again.'
fi

if [[ -n "${POSIXLY_CORRECT+1}" ]]; then
  abort 'bash must not run in POSIX mode. please unset POSIXLY_CORRECT and try again.'
fi

if [[ -t 1 ]]; then
  tty_escape() { printf "\033[%sm" "$1"; }
else
  tty_escape() { :; }
fi

tty_mkbold() { tty_escape "1;$1"; }
tty_mkdim() { tty_escape "2;$1"; }
tty_bold="$(tty_mkbold 39)"
tty_dim="$(tty_mkdim 39)"
# shellcheck disable=SC2034 # keep the shared palette available even when a given change doesn't use green directly
tty_green="$(tty_escape 32)"
tty_magenta="$(tty_escape 35)"
tty_red="$(tty_mkbold 31)"
tty_reset="$(tty_escape 0)"
tty_underline="$(tty_escape "4;39")"
tty_yellow="$(tty_escape 33)"
tty_tp="$(tty_escape '38;2;0;200;138')"    # #00c88a
# shellcheck disable=SC2034 # reserved for future plan/action styling
tty_ts="$(tty_escape '38;2;219;39;119')"   # #db2777

SCRIPT_NAME="${0##*/}"
# Keep a single top-level assignment so release automation can stamp the entrypoint in place.
SCRIPT_VERSION="v1.0.0-beta.3"

DEBUG="${EMORI_DEBUG:-${DEBUG:-${RUNNER_DEBUG:-}}}"
FORCE="${EMORI_FORCE:-}"
OP_TOKEN="${EMORI_OP_TOKEN:-${OP_SERVICE_ACCOUNT_TOKEN:-}}"
SSH_KEYS_CSV="${EMORI_SSH_KEY:-${DEFAULT_SSH_KEY}}"
EMORI_SOURCE="${EMORI_SOURCE:-${DEFAULT_EMORI_SOURCE}}"
TANAAB_SOURCE="${EMORI_TANAAB:-${DEFAULT_TANAAB_SOURCE}}"
OPENCLAW_AUTH="${EMORI_OPENCLAW_AUTH:-${DEFAULT_OPENCLAW_AUTH}}"
SKIP_OPENCLAW="${EMORI_SKIP_OPENCLAW:-}"
declare -a ORIGINAL_ARGS=("$@")
declare -a SSH_KEYS=()
declare -a SSH_KEYS_TO_INSTALL=()
declare -a SSH_KEYS_TO_OVERWRITE=()
declare -a SSH_KEYS_TO_SKIP=()
declare -a EMORI_APPLY_DOTPKGS=()
declare -a PLANNED_ACTIONS=()
BOOT_TMPDIR=""
BOOTBOX_SCRIPT_PATH=""
CORE_NEEDS_REMEDIATION="0"
CURL=""
DETECTED_ARCH=""
DETECTED_OS=""
ARCH=""
OS=""
EMORI_SOURCE_KIND=""
EMORI_SOURCE_LOCAL_PATH=""
EMORI_SOURCE_VERSION_TAG=""
EMORI_TARGET_PATH=""
TANAAB_SOURCE_KIND=""
TANAAB_SOURCE_LOCAL_PATH=""
TANAAB_SOURCE_VERSION_TAG=""
TANAAB_TARGET_PATH=""
EMORI_APPLY_BREWFILE=""
OPENCLAW_CMD=""

if [[ -n "${EMORI_SSH_KEYS:-}" ]]; then
  SSH_KEYS_CSV="${SSH_KEYS_CSV}${SSH_KEYS_CSV:+,}${EMORI_SSH_KEYS}"
fi

append_csv_to_array SSH_KEYS "${SSH_KEYS_CSV}"

if [[ "${#ORIGINAL_ARGS[@]}" -gt 0 ]]; then
  for arg in "${ORIGINAL_ARGS[@]}"; do
    case "${arg}" in
      --ssh-key | --ssh-key=* | --ssh-keys | --ssh-keys=*)
        SSH_KEYS=()
        break
        ;;
    esac
  done
fi

debug_enabled() {
  value_enabled "${DEBUG:-}"
}

force_enabled() {
  value_enabled "${FORCE:-}"
}

debug() {
  if debug_enabled; then
    printf "${tty_dim}debug${tty_reset} %s\n" "$(shell_join "$@")" >&2
  fi
}

log() {
  printf "%s\n" "$(shell_join "$@")"
}

warn() {
  printf "${tty_yellow}warn${tty_reset}: %s\n" "$(chomp "$@")" >&2
}

show_version() {
  printf "%s\n" "${SCRIPT_VERSION}"
  exit 0
}

is_semver_value() {
  [[ "${1:-}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]
}

normalize_release_tag() {
  if [[ "${1}" == v* ]]; then
    printf "%s" "${1}"
  else
    printf "v%s" "${1}"
  fi
}

normalize_repo_source_value() {
  if is_semver_value "${1}"; then
    normalize_release_tag "${1}"
  else
    printf "%s" "${1}"
  fi
}

usage() {
  local debug_display="off"
  local force_display="off"
  local ssh_keys_display="none"
  local op_token_display="none"
  local emori_display="none"
  local tanaab_display="none"
  local openclaw_skip_display="off"

  if debug_enabled; then
    debug_display="on"
  fi

  if force_enabled; then
    force_display="on"
  fi

  ssh_keys_display="$(array_join "," SSH_KEYS)"
  ssh_keys_display="${ssh_keys_display:-none}"

  if [[ -n "${OP_TOKEN:-}" ]]; then
    op_token_display="$(mask_secret_for_display "${OP_TOKEN}")"
  fi

  emori_display="$(normalize_repo_source_value "${EMORI_SOURCE}")"
  tanaab_display="$(normalize_repo_source_value "${TANAAB_SOURCE}")"

  if [[ -n "${SKIP_OPENCLAW:-}" ]]; then
    openclaw_skip_display="on"
  fi

  cat <<EOS
Usage: ${tty_dim}[NONINTERACTIVE=1] [CI=1]${tty_reset} ${tty_bold}${SCRIPT_NAME}${tty_reset} ${tty_dim}[options]${tty_reset}

${tty_tp}Options:${tty_reset}
  --ssh-key        installs 1password ssh keys as vault/item[:filename] ${tty_dim}[default: ${ssh_keys_display}]${tty_reset}
  --op-token       auths with 1password service account token ${tty_dim}[default: ${op_token_display}]${tty_reset}
  --emori          fetches emori from ssh, a local git repo path, or a release version ${tty_dim}[default: ${emori_display}]${tty_reset}
  --tanaab         fetches tanaab from ssh, a local git repo path, a release version, or a falsey disable value ${tty_dim}[default: ${tanaab_display}]${tty_reset}
  --openclaw-auth  OpenClaw onboarding auth choice ${tty_dim}[default: ${OPENCLAW_AUTH}]${tty_reset}
  --skip-openclaw  skips OpenClaw onboarding ${tty_dim}[default: ${openclaw_skip_display}]${tty_reset}
  --version        shows version of this script
  --debug          shows debug messages ${tty_dim}[default: ${debug_display}]${tty_reset}
  --force          forces supported bootbox operations ${tty_dim}[default: ${force_display}]${tty_reset}
  -h, --help       displays this help message
  -y, --yes        runs with all defaults and no prompts, sets NONINTERACTIVE=1

${tty_tp}Environment Variables:${tty_reset}
  EMORI_SSH_KEY      comma-separated list of 1password ssh keys as vault/item[:filename]
  EMORI_OP_TOKEN     1password service account token; falls back to OP_SERVICE_ACCOUNT_TOKEN
  EMORI_SOURCE       source for ~/tanaab/emori; supports ssh, local repo paths, or release versions
  EMORI_TANAAB       source for ~/tanaab/canon; supports ssh, local repo paths, release versions, or falsey disable values
  EMORI_OPENCLAW_AUTH  auth choice passed to OpenClaw onboarding
  EMORI_SKIP_OPENCLAW  set to any value to skip OpenClaw onboarding
  EMORI_FORCE        set to a truthy value to force supported operations
  EMORI_DEBUG        set to a truthy value to show debug messages
  NONINTERACTIVE      installs without prompting for user input
  CI                  installs in CI mode (e.g. does not prompt for user input)
EOS
  if [[ "${1:-0}" != "noexit" ]]; then
    exit "${1:-0}"
  fi
}

abort_option_usage() {
  usage "noexit"
  abort "$1"
}

require_next_option_value() {
  local option="$1"
  local argc="$2"

  if [[ "${argc}" -lt 2 ]]; then
    abort_option_usage "option ${tty_bold}${option}${tty_reset} requires a value."
  fi
}

require_inline_option_value() {
  local option="$1"
  local value="$2"

  if [[ -z "${value}" ]]; then
    abort_option_usage "option ${tty_bold}${option}${tty_reset} must not be empty."
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ssh-key)
        require_next_option_value "--ssh-key" "$#"
        append_array_value SSH_KEYS "$2"
        shift 2
        ;;
      --ssh-key=*)
        require_inline_option_value "--ssh-key" "${1#*=}"
        append_array_value SSH_KEYS "${1#*=}"
        shift
        ;;
      --ssh-keys)
        require_next_option_value "--ssh-keys" "$#"
        append_csv_to_array SSH_KEYS "$2"
        shift 2
        ;;
      --ssh-keys=*)
        require_inline_option_value "--ssh-keys" "${1#*=}"
        append_csv_to_array SSH_KEYS "${1#*=}"
        shift
        ;;
      --op-token)
        require_next_option_value "--op-token" "$#"
        OP_TOKEN="$2"
        shift 2
        ;;
      --op-token=*)
        require_inline_option_value "--op-token" "${1#*=}"
        OP_TOKEN="${1#*=}"
        shift
        ;;
      --emori)
        require_next_option_value "--emori" "$#"
        EMORI_SOURCE="$2"
        shift 2
        ;;
      --emori=*)
        require_inline_option_value "--emori" "${1#*=}"
        EMORI_SOURCE="${1#*=}"
        shift
        ;;
      --tanaab)
        require_next_option_value "--tanaab" "$#"
        TANAAB_SOURCE="$2"
        shift 2
        ;;
      --tanaab=*)
        require_inline_option_value "--tanaab" "${1#*=}"
        TANAAB_SOURCE="${1#*=}"
        shift
        ;;
      --openclaw-auth)
        require_next_option_value "--openclaw-auth" "$#"
        OPENCLAW_AUTH="$2"
        shift 2
        ;;
      --openclaw-auth=*)
        require_inline_option_value "--openclaw-auth" "${1#*=}"
        OPENCLAW_AUTH="${1#*=}"
        shift
        ;;
      --skip-openclaw)
        SKIP_OPENCLAW="1"
        shift
        ;;
      --debug)
        DEBUG="1"
        shift
        ;;
      --force)
        FORCE="1"
        shift
        ;;
      -h | --help)
        usage
        ;;
      --version)
        show_version
        ;;
      -y | --yes)
        NONINTERACTIVE="1"
        shift
        ;;
      *)
        usage "noexit"
        abort "unrecognized option ${tty_bold}$1${tty_reset}; see usage above."
        ;;
    esac
  done
}

detect_arch() {
  local arch
  arch="$(/usr/bin/uname -m || /usr/bin/arch || uname -m || arch)"
  if [[ "${arch}" == "arm64" ]] || [[ "${arch}" == "aarch64" ]]; then
    DETECTED_ARCH="arm64"
  elif [[ "${arch}" == "x86_64" ]] || [[ "${arch}" == "x64" ]]; then
    DETECTED_ARCH="x64"
  else
    DETECTED_ARCH="${arch}"
  fi
}

detect_os() {
  local os
  os="$(uname)"
  if [[ "${os}" == "Darwin" ]]; then
    DETECTED_OS="macos"
  else
    DETECTED_OS="${os}"
  fi
}

major_minor() {
  echo "${1%%.*}.$(
    x="${1#*.}"
    echo "${x%%.*}"
  )"
}

version_compare() (
  yy_a="$(echo "$1" | cut -d'.' -f1)"
  yy_b="$(echo "$2" | cut -d'.' -f1)"
  if [ "$yy_a" -lt "$yy_b" ]; then
    return 1
  fi
  if [ "$yy_a" -gt "$yy_b" ]; then
    return 0
  fi
  mm_a="$(echo "$1" | cut -d'.' -f2)"
  mm_b="$(echo "$2" | cut -d'.' -f2)"

  mm_a="${mm_a#0}"
  mm_b="${mm_b#0}"

  if [ "${mm_a:-0}" -lt "${mm_b:-0}" ]; then
    return 1
  fi

  return 0
)

test_curl() {
  if [[ ! -x "$1" ]]; then
    return 1
  fi

  local curl_version_output curl_name_and_version
  curl_version_output="$("$1" --version 2>/dev/null)"
  curl_name_and_version="${curl_version_output%% (*}"
  version_compare "$(major_minor "${curl_name_and_version##* }")" "$(major_minor "${REQUIRED_CURL_VERSION}")"
}

display_home_path() {
  local path="$1"

  if [[ "${path}" == "${HOME}" ]]; then
    printf "~"
    return 0
  fi

  if [[ "${path}" == "${HOME}/"* ]]; then
    printf "%s/%s" "~" "${path#"${HOME}"/}"
    return 0
  fi

  printf "%s" "${path}"
}

find_git_repo_root() {
  local path="$1"
  local parent

  while :; do
    if [[ -d "${path}/.git" ]]; then
      printf "%s" "${path}"
      return 0
    fi

    if [[ -f "${path}/HEAD" && -d "${path}/objects" && -d "${path}/refs" ]]; then
      printf "%s" "${path}"
      return 0
    fi

    parent="$(dirname "${path}")"
    if [[ "${parent}" == "${path}" ]]; then
      return 1
    fi

    path="${parent}"
  done
}

resolve_local_repo_source_path() {
  local source_path="$1"
  local absolute_path
  local repo_root

  if ! absolute_path="$(cd "${source_path}" 2>/dev/null && pwd -P)"; then
    return 1
  fi

  if ! repo_root="$(find_git_repo_root "${absolute_path}")"; then
    return 1
  fi

  printf "%s" "${repo_root}"
}

resolve_repo_source_kind() {
  local source_value="$1"
  local allow_disable="${2:-0}"

  if [[ "${allow_disable}" == "1" ]] && source_value_disabled "${source_value}"; then
    printf "disabled"
  elif [[ "${source_value}" == "ssh" ]]; then
    printf "ssh"
  elif is_semver_value "${source_value}"; then
    printf "version"
  else
    printf "local"
  fi
}

emori_target_display() {
  display_home_path "${EMORI_TARGET_PATH}"
}

tanaab_target_display() {
  display_home_path "${TANAAB_TARGET_PATH}"
}

emori_apply_brewfile_display() {
  display_home_path "${EMORI_APPLY_BREWFILE}"
}

prepare_repo_source() {
  local source_value="$1"
  local target_path="$2"
  local repo_label="$3"
  local source_kind_var="$4"
  local source_local_path_var="$5"
  local source_version_tag_var="$6"
  local allow_disable="${7:-0}"
  local source_kind=""
  local source_local_path=""
  local source_version_tag=""

  source_kind="$(resolve_repo_source_kind "${source_value}" "${allow_disable}")"

  case "${source_kind}" in
    disabled)
      ;;
    ssh)
      ;;
    version)
      source_version_tag="$(normalize_release_tag "${source_value}")"
      ;;
    local)
      if ! source_local_path="$(resolve_local_repo_source_path "${source_value}")"; then
        abort "local ${repo_label} source ${tty_ts}${source_value}${tty_reset} must resolve to a local git repo."
      fi

      if [[ "${source_local_path}" == "${target_path}" ]]; then
        abort "local ${repo_label} source ${tty_ts}${source_local_path}${tty_reset} cannot be the same as target ${tty_ts}$(display_home_path "${target_path}")${tty_reset}."
      fi
      ;;
    *)
      abort "unsupported internal ${repo_label} source kind ${tty_bold}${source_kind}${tty_reset}."
      ;;
  esac

  printf -v "${source_kind_var}" "%s" "${source_kind}"
  printf -v "${source_local_path_var}" "%s" "${source_local_path}"
  printf -v "${source_version_tag_var}" "%s" "${source_version_tag}"
}

prepare_emori_source() {
  EMORI_TARGET_PATH="${HOME}/tanaab/emori"
  prepare_repo_source \
    "${EMORI_SOURCE}" \
    "${EMORI_TARGET_PATH}" \
    "emori" \
    "EMORI_SOURCE_KIND" \
    "EMORI_SOURCE_LOCAL_PATH" \
    "EMORI_SOURCE_VERSION_TAG"
}

prepare_tanaab_source() {
  TANAAB_TARGET_PATH="${HOME}/tanaab/canon"
  prepare_repo_source \
    "${TANAAB_SOURCE}" \
    "${TANAAB_TARGET_PATH}" \
    "tanaab" \
    "TANAAB_SOURCE_KIND" \
    "TANAAB_SOURCE_LOCAL_PATH" \
    "TANAAB_SOURCE_VERSION_TAG" \
    "1"
}

tanaab_enabled() {
  [[ "${TANAAB_SOURCE_KIND}" != "disabled" ]]
}

tanaab_plugin_checkout_path() {
  printf "%s/dotfiles/ai/.codex/plugins/tanaab" "${EMORI_TARGET_PATH}"
}

tanaab_plugin_checkout_display() {
  display_home_path "$(tanaab_plugin_checkout_path)"
}

prepare_tanaab_plugin_link() {
  local ai_dotpkg_path="${EMORI_TARGET_PATH}/dotfiles/ai"
  local plugin_checkout_path
  local plugin_parent_path

  plugin_checkout_path="$(tanaab_plugin_checkout_path)"

  if ! tanaab_enabled; then
    if [[ -L "${plugin_checkout_path}" || -e "${plugin_checkout_path}" ]]; then
      execute rm -rf "${plugin_checkout_path}"
    fi
    return 0
  fi

  if [[ ! -d "${ai_dotpkg_path}" ]]; then
    abort "emori checkout at ${tty_ts}$(emori_target_display)${tty_reset} is missing required ${tty_ts}ai${tty_reset} dotpkg needed for the tanaab plugin link."
  fi

  plugin_parent_path="$(dirname "${plugin_checkout_path}")"
  execute mkdir -p "${plugin_parent_path}"

  if [[ -L "${plugin_checkout_path}" || -e "${plugin_checkout_path}" ]]; then
    execute rm -rf "${plugin_checkout_path}"
  fi

  execute ln -s "${TANAAB_PLUGIN_RELATIVE_TARGET}" "${plugin_checkout_path}"
}

discover_emori_apply_payload() {
  local dotfiles_root="${EMORI_TARGET_PATH}/dotfiles"
  local dotpkg

  EMORI_APPLY_BREWFILE="${EMORI_TARGET_PATH}/Brewfile"
  EMORI_APPLY_DOTPKGS=()

  if [[ ! -f "${EMORI_APPLY_BREWFILE}" ]]; then
    abort "emori checkout at ${tty_ts}$(emori_target_display)${tty_reset} is missing required brewfile ${tty_ts}$(emori_apply_brewfile_display)${tty_reset}."
  fi

  if [[ ! -d "${dotfiles_root}" ]]; then
    abort "emori checkout at ${tty_ts}$(emori_target_display)${tty_reset} is missing required dotfiles directory ${tty_ts}$(display_home_path "${dotfiles_root}")${tty_reset}."
  fi

  while IFS= read -r dotpkg; do
    append_array_value EMORI_APPLY_DOTPKGS "${dotpkg}"
  done < <(find "${dotfiles_root}" -mindepth 1 -maxdepth 1 -type d | LC_ALL=C sort)

  if [[ "${#EMORI_APPLY_DOTPKGS[@]}" -eq 0 ]]; then
    abort "emori checkout at ${tty_ts}$(emori_target_display)${tty_reset} must contain at least one top-level dotpkg under ${tty_ts}$(display_home_path "${dotfiles_root}")${tty_reset}."
  fi
}

build_git_ssh_command_from_ssh_keys() {
  local repo_name="${1:-repo}"
  local ssh_key
  local key_path
  local arg
  local command_string=""
  local -a ssh_command=(ssh)
  local -a existing_key_paths=()

  for ssh_key in "${SSH_KEYS[@]}"; do
    key_path="$(ssh_key_destination_path "${ssh_key}")"
    if [[ -f "${key_path}" ]]; then
      existing_key_paths+=("${key_path}")
    fi
  done

  if [[ "${#existing_key_paths[@]}" -eq 0 ]]; then
    abort "cannot clone ${tty_ts}${repo_name}${tty_reset} via ssh because no installed ssh key paths were found."
  fi

  for key_path in "${existing_key_paths[@]}"; do
    ssh_command+=(-i "${key_path}")
  done

  ssh_command+=(-o IdentitiesOnly=yes)

  for arg in "${ssh_command[@]}"; do
    printf -v command_string '%s%q ' "${command_string}" "${arg}"
  done

  printf "%s" "${command_string% }"
}

repo_release_archive_url() {
  local release_base_url="$1"
  local archive_prefix="$2"
  local tag="$3"

  printf "%s/%s/%s-%s.tar.gz" "${release_base_url}" "${tag}" "${archive_prefix}" "${tag}"
}

repo_prepare_target() {
  local target="$1"

  if [[ -e "${target}" ]]; then
    if ! force_enabled; then
      return 1
    fi

    execute rm -rf "${target}"
  fi

  execute mkdir -p "$(dirname "${target}")"
  return 0
}

fetch_repo_source_to_target() {
  local repo_name="$1"
  local source_value="$2"
  local target="$3"
  local ssh_url="$4"
  local release_base_url="$5"
  local archive_prefix="$6"
  local source_kind="$7"
  local git_ssh_command
  local archive_tag
  local archive_url
  local archive_path

  if ! repo_prepare_target "${target}"; then
    warn "${tty_tp}skipping${tty_reset} ${tty_ts}${repo_name}${tty_reset} because ${tty_ts}$(display_home_path "${target}")${tty_reset} already exists and ${tty_bold}--force${tty_reset} is not set."
    return 0
  fi

  case "${source_kind}" in
    ssh)
      git_ssh_command="$(build_git_ssh_command_from_ssh_keys "${repo_name}")"
      log "${tty_tp}cloning${tty_reset} ${tty_ts}${repo_name}${tty_reset} via ssh to ${tty_ts}$(display_home_path "${target}")${tty_reset}"
      execute env GIT_SSH_COMMAND="${git_ssh_command}" git clone "${ssh_url}" "${target}"
      ;;
    local)
      log "${tty_tp}cloning${tty_reset} ${tty_ts}${repo_name}${tty_reset} from local repo ${tty_ts}${source_value}${tty_reset} to ${tty_ts}$(display_home_path "${target}")${tty_reset}"
      execute git clone "${source_value}" "${target}"
      ;;
    version)
      archive_tag="$(normalize_release_tag "${source_value}")"
      archive_url="$(repo_release_archive_url "${release_base_url}" "${archive_prefix}" "${archive_tag}")"
      archive_path="${BOOT_TMPDIR}/${repo_name}-${archive_tag}.tar.gz"
      log "${tty_tp}extracting${tty_reset} ${tty_ts}${repo_name}${tty_reset} release ${tty_ts}${archive_tag}${tty_reset} to ${tty_ts}$(display_home_path "${target}")${tty_reset}"
      execute mkdir -p "${target}"
      execute "${CURL}" -fsSL "${archive_url}" -o "${archive_path}"
      execute tar -xzf "${archive_path}" -C "${target}"
      ;;
    *)
      abort "unsupported internal repo source kind ${tty_bold}${source_kind}${tty_reset}."
      ;;
  esac
}

plan_repo_fetch() {
  local repo_name="$1"
  local target_path="$2"
  local source_kind="$3"
  local source_local_path="$4"
  local source_version_tag="$5"
  local target_display

  target_display="$(display_home_path "${target_path}")"

  if [[ -e "${target_path}" ]]; then
    if force_enabled; then
      plan_action "${tty_tp}replace${tty_reset} existing ${tty_ts}${repo_name}${tty_reset} checkout at ${tty_ts}${target_display}${tty_reset} because ${tty_bold}--force${tty_reset} is set"
    else
      plan_action "${tty_tp}skip${tty_reset} fetching ${tty_ts}${repo_name}${tty_reset} because ${tty_ts}${target_display}${tty_reset} already exists and ${tty_bold}--force${tty_reset} is not set"
      return 0
    fi
  fi

  case "${source_kind}" in
    ssh)
      plan_action "${tty_tp}clone${tty_reset} ${tty_ts}${repo_name}${tty_reset} via ssh to ${tty_ts}${target_display}${tty_reset}"
      ;;
    local)
      plan_action "${tty_tp}clone${tty_reset} ${tty_ts}${repo_name}${tty_reset} from local repo ${tty_ts}${source_local_path}${tty_reset} to ${tty_ts}${target_display}${tty_reset}"
      ;;
    version)
      plan_action "${tty_tp}extract${tty_reset} ${tty_ts}${repo_name}${tty_reset} release ${tty_ts}${source_version_tag}${tty_reset} to ${tty_ts}${target_display}${tty_reset}"
      ;;
  esac
}

plan_emori_fetch() {
  plan_repo_fetch \
    "emori" \
    "${EMORI_TARGET_PATH}" \
    "${EMORI_SOURCE_KIND}" \
    "${EMORI_SOURCE_LOCAL_PATH}" \
    "${EMORI_SOURCE_VERSION_TAG}"
}

plan_tanaab_fetch() {
  plan_repo_fetch \
    "tanaab" \
    "${TANAAB_TARGET_PATH}" \
    "${TANAAB_SOURCE_KIND}" \
    "${TANAAB_SOURCE_LOCAL_PATH}" \
    "${TANAAB_SOURCE_VERSION_TAG}"
}

plan_tanaab_plugin_link() {
  plan_action "${tty_tp}ensure${tty_reset} relative ${tty_ts}tanaab${tty_reset} plugin link at ${tty_ts}$(tanaab_plugin_checkout_display)${tty_reset} points to ${tty_ts}$(tanaab_target_display)${tty_reset}"
}

plan_emori_apply() {
  plan_action "${tty_tp}run${tty_reset} ${tty_ts}bootbox${tty_reset} against the ${tty_ts}emori${tty_reset} checkout at ${tty_ts}$(emori_target_display)${tty_reset} using its ${tty_ts}Brewfile${tty_reset} and dotpkgs on ${tty_ts}~${tty_reset}"
}

skip_openclaw_enabled() {
  [[ -n "${SKIP_OPENCLAW:-}" ]]
}

plan_openclaw_onboarding() {
  if skip_openclaw_enabled; then
    plan_action "${tty_tp}skip${tty_reset} ${tty_ts}OpenClaw${tty_reset} onboarding because ${tty_bold}--skip-openclaw${tty_reset} or ${tty_bold}EMORI_SKIP_OPENCLAW${tty_reset} is set"
    return 0
  fi

  plan_action "${tty_tp}check${tty_reset} ${tty_ts}OpenClaw${tty_reset} app and CLI readiness, then run onboarding if it is not already ready"
}

run_emori_fetch() {
  fetch_repo_source_to_target \
    "emori" \
    "${EMORI_SOURCE_LOCAL_PATH:-${EMORI_SOURCE_VERSION_TAG:-${EMORI_SOURCE}}}" \
    "${EMORI_TARGET_PATH}" \
    "${EMORI_REPO_SSH_URL}" \
    "${EMORI_REPO_RELEASE_BASE_URL}" \
    "${EMORI_REPO_RELEASE_ARCHIVE_PREFIX}" \
    "${EMORI_SOURCE_KIND}"
}

run_tanaab_fetch() {
  fetch_repo_source_to_target \
    "tanaab" \
    "${TANAAB_SOURCE_LOCAL_PATH:-${TANAAB_SOURCE_VERSION_TAG:-${TANAAB_SOURCE}}}" \
    "${TANAAB_TARGET_PATH}" \
    "${TANAAB_REPO_SSH_URL}" \
    "${TANAAB_REPO_RELEASE_BASE_URL}" \
    "${TANAAB_REPO_RELEASE_ARCHIVE_PREFIX}" \
    "${TANAAB_SOURCE_KIND}"
}

run_bootbox_for_emori_apply() {
  local dotpkg
  local -a bootbox_args=(--brewfile "${EMORI_APPLY_BREWFILE}")

  for dotpkg in "${EMORI_APPLY_DOTPKGS[@]}"; do
    bootbox_args+=(--dotpkg "${dotpkg}")
  done

  bootbox_run_or_abort emori "bootbox failed while applying emori checkout ${tty_ts}$(emori_target_display)${tty_reset}." "${bootbox_args[@]}"
}

resolve_openclaw_command() {
  local brew_path
  local brew_prefix
  local command_path

  if [[ -n "${OPENCLAW_CMD:-}" && -x "${OPENCLAW_CMD}" ]]; then
    return 0
  fi

  command_path="$(command -v openclaw || true)"
  if [[ -n "${command_path}" && -x "${command_path}" ]]; then
    OPENCLAW_CMD="${command_path}"
    return 0
  fi

  for brew_path in "$(command -v brew || true)" /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [[ ! -x "${brew_path}" ]]; then
      continue
    fi

    brew_prefix="$("${brew_path}" --prefix 2>/dev/null || true)"
    if [[ -n "${brew_prefix}" && -x "${brew_prefix}/bin/openclaw" ]]; then
      OPENCLAW_CMD="${brew_prefix}/bin/openclaw"
      return 0
    fi
  done

  return 1
}

ensure_openclaw_installed() {
  if [[ ! -d "${HOME}/Applications/OpenClaw.app" && ! -d "/Applications/OpenClaw.app" ]]; then
    abort_multi "$(cat <<EOABORT
OpenClaw.app was not found at ${tty_ts}~/Applications/OpenClaw.app${tty_reset} or ${tty_ts}/Applications/OpenClaw.app${tty_reset}.
Rerun this wrapper so the Brewfile can install ${tty_ts}cask "openclaw"${tty_reset} into ${tty_ts}~/Applications${tty_reset}, or pass ${tty_bold}--skip-openclaw${tty_reset} to skip onboarding.
EOABORT
)"
  fi

  if ! resolve_openclaw_command; then
    abort_multi "$(cat <<EOABORT
the ${tty_ts}openclaw${tty_reset} CLI was not found after applying the Brewfile.
Rerun this wrapper so the Brewfile can install ${tty_ts}brew "openclaw-cli"${tty_reset}, or pass ${tty_bold}--skip-openclaw${tty_reset} to skip onboarding.
EOABORT
)"
  fi
}

openclaw_appears_ready() {
  if ! resolve_openclaw_command; then
    return 1
  fi

  debug "${tty_tp}checking${tty_reset}" "${tty_ts}OpenClaw${tty_reset}" "status with" "${OPENCLAW_CMD}" status --deep
  "${OPENCLAW_CMD}" status --deep >/dev/null 2>&1
}

validate_openclaw_onboarding_mode() {
  if [[ -n "${NONINTERACTIVE-}" && "${OPENCLAW_AUTH}" == "${DEFAULT_OPENCLAW_AUTH}" ]]; then
    abort_multi "$(cat <<EOABORT
OpenClaw auth choice ${tty_ts}${OPENCLAW_AUTH}${tty_reset} requires browser or device interaction, but this wrapper is running non-interactively.
Set ${tty_bold}EMORI_OPENCLAW_AUTH=openai-api-key${tty_reset} with the provider-required ${tty_bold}OPENAI_API_KEY${tty_reset}, choose another non-interactive OpenClaw auth choice with its required environment variables, or pass ${tty_bold}--skip-openclaw${tty_reset}.
EOABORT
)"
  fi
}

run_openclaw_onboarding() {
  local -a openclaw_args=(
    onboard
    --mode local
    --auth-choice "${OPENCLAW_AUTH}"
    --install-daemon
    --daemon-runtime node
  )

  if [[ -n "${NONINTERACTIVE-}" ]]; then
    openclaw_args+=(--non-interactive --json)
  fi

  if [[ -n "${CI-}" ]]; then
    openclaw_args+=(--secret-input-mode ref --accept-risk)
  fi

  log "${tty_tp}onboarding${tty_reset} ${tty_ts}OpenClaw${tty_reset} with auth choice ${tty_ts}${OPENCLAW_AUTH}${tty_reset}"
  debug "${tty_tp}running${tty_reset}" "${OPENCLAW_CMD}" "${openclaw_args[@]}"

  if ! "${OPENCLAW_CMD}" "${openclaw_args[@]}"; then
    abort_multi "$(cat <<EOABORT
OpenClaw onboarding failed.
Check that auth choice ${tty_ts}${OPENCLAW_AUTH}${tty_reset} is supported by the installed OpenClaw CLI and that the provider-required environment variables are set. For ${tty_ts}openai-api-key${tty_reset}, set ${tty_bold}OPENAI_API_KEY${tty_reset}; to skip this step, rerun with ${tty_bold}--skip-openclaw${tty_reset}.
EOABORT
)"
  fi
}

run_openclaw_post_apply() {
  if skip_openclaw_enabled; then
    log "${tty_tp}skipping${tty_reset} ${tty_ts}OpenClaw${tty_reset} onboarding because ${tty_bold}--skip-openclaw${tty_reset} or ${tty_bold}EMORI_SKIP_OPENCLAW${tty_reset} is set"
    return 0
  fi

  ensure_openclaw_installed

  if openclaw_appears_ready; then
    log "${tty_tp}skipping${tty_reset} ${tty_ts}OpenClaw${tty_reset} onboarding because OpenClaw already appears ready"
    return 0
  fi

  warn "${tty_tp}running${tty_reset} ${tty_ts}OpenClaw${tty_reset} onboarding because the status check did not pass."
  validate_openclaw_onboarding_mode
  run_openclaw_onboarding
}

plan_action() {
  PLANNED_ACTIONS+=("$1")
}

ssh_key_spec_base() {
  printf "%s" "${1%%:*}"
}

ssh_key_spec_filename_override() {
  if [[ "$1" == *:* ]]; then
    printf "%s" "${1#*:}"
  fi
}

ssh_key_spec_item() {
  local spec_base

  spec_base="$(ssh_key_spec_base "$1")"
  printf "%s" "${spec_base##*/}"
}

ssh_key_filename() {
  local filename_override

  filename_override="$(ssh_key_spec_filename_override "$1")"
  if [[ -n "${filename_override}" ]]; then
    printf "%s" "${filename_override}"
    return 0
  fi

  ssh_key_spec_item "$1"
}

ssh_key_target_root() {
  printf "%s" "${EMORI_TARGET:-${HOME}}"
}

ssh_key_destination_path() {
  printf "%s/.ssh/%s" "$(ssh_key_target_root)" "$(ssh_key_filename "$1")"
}

describe_ssh_key_specs() {
  local first="1"
  local ssh_key
  local destination_path

  if [[ $# -eq 0 ]]; then
    return 0
  fi

  for ssh_key in "$@"; do
    if [[ "${first}" == "1" ]]; then
      first="0"
    else
      printf ", "
    fi

    destination_path="$(ssh_key_destination_path "${ssh_key}")"
    printf "%s ${tty_dim}->${tty_reset} ${tty_ts}%s${tty_reset}" "${ssh_key}" "${destination_path}"
  done
}

collect_ssh_key_actions() {
  local ssh_key
  local destination_path

  SSH_KEYS_TO_INSTALL=()
  SSH_KEYS_TO_OVERWRITE=()
  SSH_KEYS_TO_SKIP=()

  if [[ "${#SSH_KEYS[@]}" -gt 0 ]]; then
    for ssh_key in "${SSH_KEYS[@]}"; do
      destination_path="$(ssh_key_destination_path "${ssh_key}")"

      if [[ -e "${destination_path}" ]]; then
        if force_enabled; then
          SSH_KEYS_TO_OVERWRITE+=("${ssh_key}")
        else
          SSH_KEYS_TO_SKIP+=("${ssh_key}")
        fi
      else
        SSH_KEYS_TO_INSTALL+=("${ssh_key}")
      fi
    done
  fi
}

have_planned_actions() {
  [[ "${#PLANNED_ACTIONS[@]}" -gt 0 ]]
}

show_planned_actions() {
  if ! have_planned_actions; then
    return 0
  fi

  log "${tty_bold}this script is about to:${tty_reset}"
  log

  local action
  for action in "${PLANNED_ACTIONS[@]}"; do
    log "  - ${action}"
  done
}

getc() {
  local save_state
  save_state="$(/bin/stty -g)"
  /bin/stty raw -echo
  IFS='' read -r -n 1 -d '' "$@"
  /bin/stty "${save_state}"
}

wait_for_user() {
  local c

  trap 'stty sane; tput sgr0; echo; exit 1' SIGINT

  echo
  echo "press ${tty_bold}RETURN${tty_reset}/${tty_bold}ENTER${tty_reset} to continue or any other key to abort:"
  getc c
  if ! [[ "${c}" == $'\r' || "${c}" == $'\n' ]]; then
    exit 1
  fi
}

execute() {
  debug "${tty_tp}running${tty_reset}" "$@"
  if ! "$@"; then
    abort "$(printf "failed during: %s" "$(shell_join "$@")")"
  fi
}

cleanup() {
  if [[ -n "${BOOT_TMPDIR:-}" && -d "${BOOT_TMPDIR}" ]]; then
    rm -rf "${BOOT_TMPDIR}"
  fi
}

validate_inputs() {
  if [[ -z "${OP_TOKEN:-}" ]]; then
    abort_multi "$(cat <<EOABORT
you must provide a 1Password service account token before using this wrapper.
set ${tty_bold}EMORI_OP_TOKEN${tty_reset} or ${tty_bold}OP_SERVICE_ACCOUNT_TOKEN${tty_reset}, or pass ${tty_bold}--op-token${tty_reset}.
EOABORT
)"
  fi

  if [[ "${#SSH_KEYS[@]}" -eq 0 ]]; then
    abort "at least one ssh key is required. pass --ssh-key or set EMORI_SSH_KEY."
  fi

}

validate_platform() {
  detect_arch
  detect_os

  ARCH="${EMORI_ARCH:-${DETECTED_ARCH}}"
  OS="${EMORI_OS:-${DETECTED_OS}}"

  if [[ "${EUID:-${UID}}" == "0" ]]; then
    abort "cannot run this script as root."
  fi

  CURL="$(command -v curl || true)"
  if [[ -z "${CURL}" ]] || ! test_curl "${CURL}"; then
    abort_multi "$(cat <<EOABORT
you must install cURL ${REQUIRED_CURL_VERSION} or higher before using this wrapper.
EOABORT
)"
  fi

  if [[ "${OS}" != "macos" ]]; then
    abort_multi "$(cat <<EOABORT
this script only supports ${tty_ts}macOS${tty_reset}; ${tty_red}${OS}${tty_reset} is not supported.
check the project README for current support details: ${tty_underline}${tty_magenta}https://github.com/tanaabased/emori${tty_reset}
EOABORT
)"
  fi

  if [[ "${ARCH}" != "x64" ]] && [[ "${ARCH}" != "arm64" ]]; then
    abort_multi "$(cat <<EOABORT
this script currently only supports ${tty_ts}x64${tty_reset} and ${tty_ts}arm64${tty_reset} systems.
check the project README for current support details: ${tty_underline}${tty_magenta}https://github.com/tanaabased/emori${tty_reset}
EOABORT
)"
  fi

  local macos_version
  macos_version="$(major_minor "$(/usr/bin/sw_vers -productVersion)")"
  if ! version_compare "${macos_version}" "${MACOS_OLDEST_SUPPORTED}"; then
    abort_multi "$(cat <<EOABORT
your macOS version ${tty_red}${macos_version}${tty_reset} is ${tty_bold}too old${tty_reset}; minimum supported version is ${tty_ts}${MACOS_OLDEST_SUPPORTED}${tty_reset}.
check the project README for current support details: ${tty_underline}${tty_magenta}https://github.com/tanaabased/emori${tty_reset}
EOABORT
)"
  fi
}

apply_noninteractive_mode() {
  # shellcheck disable=SC2016
  if [[ -z "${NONINTERACTIVE-}" ]]; then
    if [[ -n "${CI-}" ]]; then
      warn "${tty_tp}running${tty_reset} in ${tty_ts}non-interactive mode${tty_reset} because \`\$CI\` is set."
      NONINTERACTIVE=1
    elif [[ ! -t 0 ]]; then
      if [[ -z "${INTERACTIVE-}" ]]; then
        warn "${tty_tp}running${tty_reset} in ${tty_ts}non-interactive mode${tty_reset} because \`stdin\` is not a TTY."
        NONINTERACTIVE=1
      else
        warn "${tty_tp}running${tty_reset} in ${tty_ts}interactive mode${tty_reset} despite \`stdin\` not being a TTY because \`\$INTERACTIVE\` is set."
      fi
    fi
  else
    log "${tty_tp}running${tty_reset} in ${tty_ts}non-interactive mode${tty_reset} ${tty_dim}because \$NONINTERACTIVE is set${tty_reset}"
  fi
}

sync_bootbox_env() {
  if [[ -n "${NONINTERACTIVE-}" ]]; then
    export NONINTERACTIVE="${NONINTERACTIVE}"
  else
    unset NONINTERACTIVE || true
  fi
}

core_remediation_needed() {
  [[ "${CORE_NEEDS_REMEDIATION:-0}" == "1" ]]
}

run_bootbox_from_tmpdir() (
  cd "${BOOT_TMPDIR}" || exit 1
  "$@"
)

bootbox_run() {
  local mode="$1"
  shift

  local env_name
  local arg
  local mask_next="0"
  local -a unset_env_names=(
    TANAAB_BREWFILE
    TANAAB_BREWFILES
    TANAAB_DOTPKG
    TANAAB_DOTPKGS
    TANAAB_SSH_KEY
    TANAAB_SSH_KEYS
    TANAAB_OP_TOKEN
    OP_SERVICE_ACCOUNT_TOKEN
    TANAAB_FORCE
    TANAAB_DEBUG
    TANAAB_ARCH
    TANAAB_OS
    INTERACTIVE
  )
  local -a bootbox_command=(env)
  local -a bootbox_display_command=()

  case "${mode}" in
    core)
      unset_env_names+=("TANAAB_TARGET")
      ;;
    ssh)
      unset_env_names+=("TANAAB_TARGET")
      ;;
    emori)
      unset_env_names+=("TANAAB_TARGET")
      ;;
    *)
      abort "unsupported internal bootbox mode ${tty_bold}${mode}${tty_reset}."
      ;;
  esac

  for env_name in "${unset_env_names[@]}"; do
    bootbox_command+=(-u "${env_name}")
  done

  if [[ -n "${DEBUG-}" ]]; then
    bootbox_command+=("TANAAB_DEBUG=${DEBUG}")
    bootbox_display_command+=("EMORI_DEBUG=${DEBUG}")
  fi

  if [[ -n "${FORCE-}" ]]; then
    bootbox_command+=("TANAAB_FORCE=${FORCE}")
    bootbox_display_command+=("EMORI_FORCE=${FORCE}")
  fi

  # The wrapper owns the confirmation gate; delegated bootbox runs should not prompt again.
  bootbox_command+=("NONINTERACTIVE=1")
  bootbox_display_command+=("NONINTERACTIVE=1")

  if [[ "${mode}" == "ssh" && -n "${EMORI_TARGET-}" ]]; then
    bootbox_command+=("TANAAB_TARGET=${EMORI_TARGET}")
    bootbox_display_command+=("EMORI_TARGET=${EMORI_TARGET}")
  fi

  bootbox_command+=(/bin/bash "${BOOTBOX_SCRIPT_PATH}")
  bootbox_display_command+=(/bin/bash "${BOOTBOX_SCRIPT_PATH}")

  for arg in "$@"; do
    bootbox_command+=("${arg}")

    if [[ "${mask_next}" == "1" ]]; then
      bootbox_display_command+=("$(mask_secret_for_display "${arg}")")
      mask_next="0"
      continue
    fi

    if [[ "${arg}" == --op-token=* ]]; then
      bootbox_display_command+=("--op-token=$(mask_secret_for_display "${arg#*=}")")
      continue
    fi

    bootbox_display_command+=("${arg}")

    if [[ "${arg}" == "--op-token" ]]; then
      mask_next="1"
    fi
  done

  debug "${tty_tp}delegating${tty_reset} to ${tty_ts}bootbox${tty_reset} from ${tty_ts}${BOOT_TMPDIR}${tty_reset} with $(shell_join "${bootbox_display_command[@]}")"
  run_bootbox_from_tmpdir "${bootbox_command[@]}"
}

bootbox_run_or_abort() {
  local mode="$1"
  local failure_message="$2"
  shift 2

  if ! bootbox_run "${mode}" "$@"; then
    abort "${failure_message}"
  fi
}

plan_wrapper_execution() {
  if core_remediation_needed; then
    plan_action "${tty_tp}ensure${tty_reset} ${tty_ts}homebrew${tty_reset} is installed"
    plan_action "${tty_tp}install${tty_reset} ${tty_ts}core homebrew packages${tty_reset}"
  fi

  collect_ssh_key_actions

  if [[ "${#SSH_KEYS_TO_INSTALL[@]}" -gt 0 ]]; then
    plan_action "${tty_tp}install${tty_reset} ssh keys: $(describe_ssh_key_specs "${SSH_KEYS_TO_INSTALL[@]}")"
  fi

  if [[ "${#SSH_KEYS_TO_OVERWRITE[@]}" -gt 0 ]]; then
    plan_action "${tty_tp}overwrite${tty_reset} existing ssh keys because ${tty_bold}--force${tty_reset} is set: $(describe_ssh_key_specs "${SSH_KEYS_TO_OVERWRITE[@]}")"
  fi

  if [[ "${#SSH_KEYS_TO_SKIP[@]}" -gt 0 ]]; then
    plan_action "${tty_tp}skip${tty_reset} existing ssh keys because ${tty_bold}--force${tty_reset} is not set: $(describe_ssh_key_specs "${SSH_KEYS_TO_SKIP[@]}")"
  fi

  plan_emori_fetch
  if tanaab_enabled; then
    plan_tanaab_fetch
    plan_tanaab_plugin_link
  fi
  plan_emori_apply
  plan_openclaw_onboarding
}

prepare_bootbox_script() {
  BOOT_TMPDIR="$(mktemp -d -t emori-boot.XXXXXX)"
  BOOTBOX_SCRIPT_PATH="${BOOT_TMPDIR}/bootbox.sh"

  execute "${CURL}" -fsSL "${BOOTBOX_URL}" -o "${BOOTBOX_SCRIPT_PATH}"
  execute chmod 700 "${BOOTBOX_SCRIPT_PATH}"
}

run_bootbox_check_core() {
  debug "${tty_tp}checking${tty_reset} ${tty_ts}bootbox core requirements${tty_reset} from ${tty_ts}${BOOT_TMPDIR}${tty_reset}"
  if bootbox_run core --check-core; then
    CORE_NEEDS_REMEDIATION="0"
    debug "bootbox core requirements are satisfied"
    return 0
  fi

  CORE_NEEDS_REMEDIATION="1"
  debug "bootbox core requirements need remediation"
  return 1
}

ensure_bootbox_core_requirements() {
  if ! core_remediation_needed; then
    return 0
  fi

  bootbox_run_or_abort core "bootbox failed while ensuring core requirements."
  if ! run_bootbox_check_core; then
    abort "bootbox core requirements are still not satisfied after remediation."
  fi
}

run_bootbox_for_ssh_key() {
  local ssh_key="$1"
  bootbox_run_or_abort ssh "bootbox failed while installing ssh key ${tty_ts}$(ssh_key_filename "${ssh_key}")${tty_reset}." \
    --op-token "${OP_TOKEN}" --ssh-key "${ssh_key}"
}

run_bootbox() {
  local ssh_key
  local destination_path
  local -a ssh_keys_to_run=()

  collect_ssh_key_actions

  if [[ "${#SSH_KEYS_TO_SKIP[@]}" -gt 0 ]]; then
    for ssh_key in "${SSH_KEYS_TO_SKIP[@]}"; do
      destination_path="$(ssh_key_destination_path "${ssh_key}")"
      warn "${tty_tp}skipping${tty_reset} ssh key ${tty_ts}${ssh_key}${tty_reset} because ${tty_ts}${destination_path}${tty_reset} already exists and ${tty_bold}--force${tty_reset} is not set."
    done
  fi

  if [[ "${#SSH_KEYS_TO_INSTALL[@]}" -eq 0 && "${#SSH_KEYS_TO_OVERWRITE[@]}" -eq 0 ]]; then
    debug "no SSH keys require installation after wrapper-side filtering"
    return 0
  fi

  if [[ "${#SSH_KEYS_TO_INSTALL[@]}" -gt 0 ]]; then
    ssh_keys_to_run+=("${SSH_KEYS_TO_INSTALL[@]}")
  fi

  if [[ "${#SSH_KEYS_TO_OVERWRITE[@]}" -gt 0 ]]; then
    ssh_keys_to_run+=("${SSH_KEYS_TO_OVERWRITE[@]}")
  fi

  for ssh_key in "${ssh_keys_to_run[@]}"; do
    run_bootbox_for_ssh_key "${ssh_key}"
  done
}

main() {
  trap cleanup EXIT
  parse_args "$@"
  validate_inputs
  validate_platform
  ensure_homebrew_prefix_access
  apply_noninteractive_mode
  sync_bootbox_env

  debug "${tty_tp}running${tty_reset}" "${SCRIPT_NAME}" script version: "${SCRIPT_VERSION}"
  debug raw CI="${CI:-}"
  debug raw NONINTERACTIVE="${NONINTERACTIVE:-}"
  debug raw DEBUG="${DEBUG:-}"
  debug raw FORCE="${FORCE:-}"
  debug raw OP_TOKEN="$(mask_secret_for_display "${OP_TOKEN}")"
  debug raw SSH_KEYS="$(array_join "," SSH_KEYS)"
  debug raw EMORI="$(normalize_repo_source_value "${EMORI_SOURCE}")"
  debug raw TANAAB="$(normalize_repo_source_value "${TANAAB_SOURCE}")"
  debug raw OPENCLAW_AUTH="${OPENCLAW_AUTH}"
  debug raw SKIP_OPENCLAW="${SKIP_OPENCLAW:-}"
  debug raw BOOTBOX_URL="${BOOTBOX_URL}"
  debug raw CURL="${CURL}"
  debug raw ARCH="${ARCH}"
  debug raw OS="${OS}"
  prepare_emori_source
  prepare_tanaab_source
  debug raw EMORI_SOURCE_KIND="${EMORI_SOURCE_KIND}"
  debug raw EMORI_TARGET="$(emori_target_display)"
  debug raw TANAAB_SOURCE_KIND="${TANAAB_SOURCE_KIND}"
  debug raw TANAAB_TARGET="$(tanaab_target_display)"

  prepare_bootbox_script
  run_bootbox_check_core || true
  debug raw CORE_NEEDS_REMEDIATION="${CORE_NEEDS_REMEDIATION}"
  plan_wrapper_execution

  if [[ -z "${NONINTERACTIVE-}" ]] && have_planned_actions; then
    show_planned_actions
    wait_for_user
  fi

  ensure_bootbox_core_requirements
  run_bootbox
  run_emori_fetch
  if tanaab_enabled; then
    run_tanaab_fetch
  fi
  prepare_tanaab_plugin_link
  discover_emori_apply_payload
  debug raw EMORI_APPLY_BREWFILE="$(emori_apply_brewfile_display)"
  debug raw EMORI_APPLY_DOTPKGS="$(array_join "," EMORI_APPLY_DOTPKGS)"
  run_bootbox_for_emori_apply
  run_openclaw_post_apply
}

main "$@"
