# CLI Contract Example

This example keeps only basic Leia coverage on the shell-facing contract of `boot.sh`. It validates
the prepared wrapper's help and version output without running the full machine-seeding flow.

This scenario is intended to run in CI by default. Do not run it locally unless the task explicitly
calls for a local Leia run.

## Setup

```bash
# should prepare a temp directory for precedence checks
mkdir -p .tmp
```

## Testing

```bash
# should show the required op token flag in help output
boot.sh --help | grep -- '--op-token'

# should show the ssh key flag in help output
boot.sh --help | grep -- '--ssh-key'

# should show the emori flag in help output
boot.sh --help | grep -- '--emori'

# should show the tanaab flag in help output
boot.sh --help | grep -- '--tanaab'

# should show the OpenClaw auth flag in help output
boot.sh --help | grep -- '--openclaw-auth'

# should show the OpenClaw skip flag in help output
boot.sh --help | grep -- '--skip-openclaw'

# should show the default ssh key in help output
boot.sh --help | grep -F '2mh2ny4tegbi33yt3furutomzu/id_emori'

# should show the default emori source in help output
boot.sh --help | grep -F '[default: ssh]'

# should show the EMORI_OP_TOKEN envvar in help output
boot.sh --help | grep -F 'EMORI_OP_TOKEN'

# should show the EMORI_SSH_KEY envvar in help output
boot.sh --help | grep -F 'EMORI_SSH_KEY'

# should show the EMORI_SOURCE envvar in help output
boot.sh --help | grep -F 'EMORI_SOURCE'

# should show the EMORI_TANAAB envvar in help output
boot.sh --help | grep -F 'EMORI_TANAAB'

# should show the EMORI_OPENCLAW_AUTH envvar in help output
boot.sh --help | grep -F 'EMORI_OPENCLAW_AUTH'

# should show the EMORI_SKIP_OPENCLAW envvar in help output
boot.sh --help | grep -F 'EMORI_SKIP_OPENCLAW'

# should show the EMORI_FORCE envvar in help output
boot.sh --help | grep -F 'EMORI_FORCE'

# should show the EMORI_DEBUG envvar in help output
boot.sh --help | grep -F 'EMORI_DEBUG'

# should let EMORI_SSH_KEY override the displayed ssh key default
EMORI_SSH_KEY='example-vault/example-item:id_example' boot.sh --help | grep -F 'example-vault/example-item:id_example'

# should append EMORI_SSH_KEYS to the displayed ssh key default
EMORI_SSH_KEYS='example-vault/example-item:id_extra' boot.sh --help | grep -F '2mh2ny4tegbi33yt3furutomzu/id_emori,example-vault/example-item:id_extra'

# should append EMORI_SSH_KEYS after EMORI_SSH_KEY when both are set
EMORI_SSH_KEY='example-vault/example-item:id_primary' EMORI_SSH_KEYS='example-vault/example-item:id_secondary' boot.sh --help | grep -F 'example-vault/example-item:id_primary,example-vault/example-item:id_secondary'

# should keep EMORI_SSH_KEYS hidden from help output
! boot.sh --help | grep -F 'EMORI_SSH_KEYS'

# should let EMORI_SOURCE override the displayed emori default
EMORI_SOURCE='/tmp/example-emori-source' boot.sh --help | grep -F '/tmp/example-emori-source'

# should let EMORI_TANAAB override the displayed tanaab default
EMORI_TANAAB='/tmp/example-tanaab-source' boot.sh --help | grep -F '/tmp/example-tanaab-source'

# should let EMORI_OPENCLAW_AUTH override the displayed OpenClaw auth default
EMORI_OPENCLAW_AUTH='openai-api-key' boot.sh --help | grep -F '[default: openai-api-key]'

# should let --openclaw-auth override EMORI_OPENCLAW_AUTH
EMORI_OPENCLAW_AUTH='openai-api-key' boot.sh --openclaw-auth openai-device-code --help | grep -F '[default: openai-device-code]'

# should let --skip-openclaw show OpenClaw onboarding as skipped
boot.sh --skip-openclaw --help | grep -F '[default: on]'

# should normalize semantic version emori defaults for display
boot.sh --emori 0.3.1 --help | grep -F 'v0.3.1'

# should normalize prerelease semantic version emori defaults for display
boot.sh --emori 1.0.0-beta.4 --help | grep -F 'v1.0.0-beta.4'

# should normalize semantic version tanaab defaults for display
boot.sh --tanaab 0.2.0 --help | grep -F 'v0.2.0'

# should let --emori override EMORI_SOURCE
EMORI_SOURCE='/tmp/example-emori-source' boot.sh --emori 0.3.1 --help | grep -F 'v0.3.1'

# should let --tanaab override EMORI_TANAAB
EMORI_TANAAB='/tmp/example-tanaab-source' boot.sh --tanaab 0.2.0 --help | grep -F 'v0.2.0'

# should display falsey tanaab disable values in help output
boot.sh --tanaab false --help | grep -F 'false'

# should not mention the TANAAB_ envvar namespace in help output
! boot.sh --help | grep -F 'TANAAB_'

# should print a version string
test -n "$(boot.sh --version)"

# should fail for an unknown option
! boot.sh --definitely-bogus > .tmp/invalid.log 2>&1

# should explain the unknown option failure
grep -F 'unrecognized option' .tmp/invalid.log
```

## Destroy tests

```bash
# should remove the example scratch directory
rm -rf .tmp
```
