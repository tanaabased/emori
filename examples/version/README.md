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

# should also brew trust oven-sh/bun for legacy version support
brew trust oven-sh/bun

# should run boot.sh successfully using the default ssh emori and tanaab sources
boot.sh \
  --identity 'EMORI <emori-version@example.test>' \
  --op-token "$OPTOKEN" \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
  --emori ssh \
  --skip-openclaw
test -d "$HOME/tanaab/emori/.git"
git -C "$HOME/tanaab/emori" remote get-url origin > "$TMPDIR/emori.ssh.origin"
test -d "$HOME/tanaab/canon/.git"
git -C "$HOME/tanaab/canon" remote get-url origin > "$TMPDIR/tanaab.ssh.origin"

# should run boot.sh successfully using released emori and tanaab sources and replace the existing checkouts
boot.sh \
  --identity 'EMORI <emori-version@example.test>' \
  --op-token "$OPTOKEN" \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
  --emori v1.0.0-beta.1 \
  --tanaab v0.4.0 \
  --force \
  --skip-openclaw
```

## Testing

```bash
# should have cloned emori via ssh before replacing it with the release archive
test "$(cat "$TMPDIR/emori.ssh.origin")" = "git@github.com:tanaabased/emori.git"

# should have cloned tanaab canon via ssh before replacing it with the release archive
test "$(cat "$TMPDIR/tanaab.ssh.origin")" = "git@github.com:tanaabased/canon.git"

# should seed GitHub SSH known hosts
grep -qxF 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' "$HOME/.ssh/known_hosts"
grep -qxF 'github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=' "$HOME/.ssh/known_hosts"
grep -qxF 'github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=' "$HOME/.ssh/known_hosts"

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
