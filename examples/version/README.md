# Version Example

This example keeps coverage on non-local repository materialization in `boot.sh`, with emphasis on
released-version fetch behavior for both `emori` and `tanaab`. It verifies that the wrapper can clone
both surfaces via ssh, then replace both checkouts in place with released archives.

This scenario is intended to run in CI by default. Do not run it locally unless the task explicitly
calls for a local Leia run.

## Setup

```bash
# should remove any previous version example targets
rm -rf "$HOME/tanaab/emori" "$HOME/tanaab/canon"

# should remove any previously installed tanaab plugin link
rm -f "$HOME/.codex/plugins/tanaab"

# should have the op token test secret available
test -n "$OPTOKEN"

# should run boot.sh successfully using the default ssh emori and tanaab sources
boot.sh \
  --op-token "$OPTOKEN" \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
  --emori ssh
test -d "$HOME/tanaab/emori/.git"
git -C "$HOME/tanaab/emori" remote get-url origin > "$TMPDIR/emori.ssh.origin"
test -d "$HOME/tanaab/canon/.git"
git -C "$HOME/tanaab/canon" remote get-url origin > "$TMPDIR/tanaab.ssh.origin"

# should run boot.sh successfully using released emori and tanaab sources and replace the existing checkouts
boot.sh \
  --op-token "$OPTOKEN" \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
  --emori v1.0.0-beta.1 \
  --tanaab v0.4.0 \
  --force
```

## Testing

```bash
# should have cloned emori via ssh before replacing it with the release archive
test "$(cat "$TMPDIR/emori.ssh.origin")" = "git@github.com:tanaabased/emori.git"

# should have cloned tanaab canon via ssh before replacing it with the release archive
test "$(cat "$TMPDIR/tanaab.ssh.origin")" = "git@github.com:tanaabased/canon.git"

# should extract the version emori release archive in place
test -f "$HOME/tanaab/emori/boot.sh"

# should include the plugin manifest in the version emori release archive
test -f "$HOME/tanaab/emori/.codex-plugin/plugin.json"

# should extract the version tanaab release archive in place
test -f "$HOME/tanaab/canon/README.md"

# should include the plugin manifest in the version tanaab release archive
test -f "$HOME/tanaab/canon/.codex-plugin/plugin.json"

# should distinguish the extracted release tree from a git checkout
! test -d "$HOME/tanaab/emori/.git"

# should distinguish the extracted tanaab release tree from a git checkout
! test -d "$HOME/tanaab/canon/.git"

# should stow the tanaab plugin link against the released canon checkout
test -L "$HOME/.codex/plugins/tanaab"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.codex/plugins/tanaab")" = "$HOME/tanaab/canon"
```

## Destroy tests

```bash
# should remove the installed example ssh key
rm -f "$HOME/.ssh/id_test"

# should remove the stowed tanaab plugin link
rm -f "$HOME/.codex/plugins/tanaab"

# should remove the version example targets
rm -rf "$HOME/tanaab/emori" "$HOME/tanaab/canon"
```
