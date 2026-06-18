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

# should show the signing key flag in help output
boot.sh --help | grep -- '--signing-key'

# should show the authorized key flag in help output
boot.sh --help | grep -- '--authorized-key'

# should show the identity flag in help output
boot.sh --help | grep -- '--identity'

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

# should show the EMORI_SIGNING_KEY envvar in help output
boot.sh --help | grep -F 'EMORI_SIGNING_KEY'

# should show the EMORI_AUTHORIZED_KEY envvar in help output
boot.sh --help | grep -F 'EMORI_AUTHORIZED_KEY'

# should show the EMORI_IDENTITY envvar in help output
boot.sh --help | grep -F 'EMORI_IDENTITY'

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

# should keep hidden plural authorized-key inputs out of help
! boot.sh --help | grep -F -- '--authorized-keys'
! boot.sh --help | grep -F 'EMORI_AUTHORIZED_KEYS'

# should let EMORI_SIGNING_KEY override the displayed signing key default
EMORI_SIGNING_KEY='example-vault/example-signing:id_signing_env' boot.sh --help | grep -F 'example-vault/example-signing:id_signing_env'

# should let --signing-key override EMORI_SIGNING_KEY
EMORI_SIGNING_KEY='example-vault/example-signing:id_signing_env' boot.sh --signing-key 'example-vault/example-signing:id_signing_cli' --help | grep -F 'example-vault/example-signing:id_signing_cli'

# should display an env-provided authorized key count
EMORI_AUTHORIZED_KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAuthorizedEnvKeyExample0000000000000000000000000000 env@example.test' boot.sh --help | grep -F '[default: 1 provided]'

# should let the first CLI authorized-key option replace env-provided authorized keys
EMORI_AUTHORIZED_KEYS='env-one,env-two' boot.sh --authorized-key 'cli-one' --help | grep -F '[default: 1 provided]'

# should append later CLI authorized-key options after the first CLI override
EMORI_AUTHORIZED_KEYS='env-one,env-two' boot.sh --authorized-key 'cli-one' --authorized-key 'cli-two' --help | grep -F '[default: 2 provided]'

# should let EMORI_IDENTITY override the displayed identity default
EMORI_IDENTITY='Env User <env@example.test>' boot.sh --help | grep -F 'Env User <env@example.test>'

# should let --identity override EMORI_IDENTITY
EMORI_IDENTITY='Env User <env@example.test>' boot.sh --identity 'CLI User <cli@example.test>' --help | grep -F 'CLI User <cli@example.test>'

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

# should not mention the BOOTBOX_ envvar namespace in help output
! boot.sh --help | grep -F 'BOOTBOX_'

# should print a version string
test -n "$(boot.sh --version)"

# should fail for an unknown option
! boot.sh --definitely-bogus > .tmp/invalid.log 2>&1

# should explain the unknown option failure
grep -F 'unrecognized option' .tmp/invalid.log

# should fail before bootstrap work when identity is missing
! boot.sh > .tmp/missing-identity.log 2>&1

# should explain the missing identity failure
grep -F 'option --identity is required' .tmp/missing-identity.log

# should fail before bootstrap work when identity is malformed
! boot.sh --identity 'Invalid Identity' > .tmp/invalid-identity.log 2>&1

# should explain the malformed identity failure
grep -F 'must use the format' .tmp/invalid-identity.log

# should fail before bootstrap work when signing key is malformed
! boot.sh --identity 'Test User <test@example.test>' --signing-key 'Invalid Signing Key' > .tmp/invalid-signing-key.log 2>&1

# should explain the malformed signing key failure
grep -F 'must use vault/item[:filename] format' .tmp/invalid-signing-key.log

# should fail before bootstrap work when signing key is repeated
! boot.sh --identity 'Test User <test@example.test>' --signing-key 'example-vault/example-signing:id_one' --signing-key 'example-vault/example-signing:id_two' > .tmp/repeated-signing-key.log 2>&1

# should explain the repeated signing key failure
grep -F 'can only be provided once' .tmp/repeated-signing-key.log

# should fail before bootstrap work when signing key filename is not a valid principal
! boot.sh --identity 'Test User <test@example.test>' --signing-key 'example-vault/example-signing:bad,principal' > .tmp/invalid-signing-principal.log 2>&1

# should explain the invalid signing key principal failure
grep -F 'filename must not contain whitespace or commas' .tmp/invalid-signing-principal.log

# should fail before bootstrap work when a raw authorized key is invalid
! boot.sh --identity 'Test User <test@example.test>' --authorized-key 'not-a-public-key' > .tmp/invalid-authorized-key.log 2>&1

# should explain the invalid raw authorized key failure
grep -F 'must be a public key line' .tmp/invalid-authorized-key.log

# should fail before bootstrap work when an authorized key value looks like private-key material
! boot.sh --identity 'Test User <test@example.test>' --authorized-key '-----BEGIN OPENSSH PRIVATE KEY-----' > .tmp/private-authorized-key.log 2>&1

# should explain the private-key-like authorized key failure
grep -F 'appears to contain private key material' .tmp/private-authorized-key.log

# should fail before bootstrap work when an authorized key file is missing
! boot.sh --identity 'Test User <test@example.test>' --authorized-key 'file:.tmp/missing-authorized-key.pub' > .tmp/missing-authorized-key.log 2>&1

# should explain the missing authorized key file failure
grep -F 'does not exist' .tmp/missing-authorized-key.log

# should fail before bootstrap work when an authorized key file contains invalid public-key lines
printf '%s\n' 'not-a-public-key' > .tmp/invalid-authorized-key.pub
! boot.sh --identity 'Test User <test@example.test>' --authorized-key 'file:.tmp/invalid-authorized-key.pub' > .tmp/invalid-authorized-key-file.log 2>&1

# should explain the invalid authorized key file failure
grep -F 'contains an invalid public key line' .tmp/invalid-authorized-key-file.log

# should fail before bootstrap work when an op authorized key reference is malformed
! boot.sh --identity 'Test User <test@example.test>' --authorized-key 'op:/bad' > .tmp/malformed-authorized-key-op.log 2>&1

# should explain the malformed op authorized key failure
grep -F 'op://vault/item[:filename]' .tmp/malformed-authorized-key-op.log
```

## Destroy tests

```bash
# should remove the example scratch directory
rm -rf .tmp
```
