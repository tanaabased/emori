# Options Example

This example keeps coverage on the shell-facing option contract of `boot.sh`. It runs the wrapper
with CLI flags, delegates into bootbox, and then verifies that the requested SSH keys were
installed, that `emori` was materialized from a local checkout, and that the post-fetch bootbox apply
step used the `emori` checkout's brewfile and dotpkgs on the default target directory. It also verifies
that the default `--tanaab ssh` flow materialized canon and stowed the `tanaab` plugin link through
the `ai` dotpkg, while still covering the wrapper-specific behavior of skipping an existing
destination key and continuing with the remaining requested keys.

This scenario is intended to run in CI by default. Do not run it locally unless the task explicitly
calls for a local Leia run.

## Setup

```bash
# should remove a core formula first
brew uninstall --formula --force stow || true

# should prepare the default ssh target directory
mkdir -p "$HOME/.ssh"

# should remove an existing emori checkout target
rm -rf "$HOME/tanaab/emori"

# should remove an existing tanaab canon checkout target
rm -rf "$HOME/tanaab/canon"

# should remove any previously installed tanaab plugin link
rm -f "$HOME/.codex/plugins/tanaab"

# should have the local emori source repo available
test -d "$GITHUB_WORKSPACE/.git"

# should have the op token test secret available
test -n "$OPTOKEN"

# should run boot.sh successfully using options while skipping an existing key and continuing
boot.sh \
  --op-token "$OPTOKEN" \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
  --emori "$GITHUB_WORKSPACE"
boot.sh \
  --op-token "$OPTOKEN" \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
  --ssh-key 'omfsw2uztmi2xqpid5g3kiv6ba/id_test:id_test_options' \
  --debug \
  --emori "$GITHUB_WORKSPACE"
```

## Testing

```bash
# should ensure homebrew is installed
command -v brew >/dev/null

# should install core homebrew packages
command -v git >/dev/null && command -v jq >/dev/null && command -v stow >/dev/null && command -v op >/dev/null

# should satisfy the emori checkout brewfile
brew bundle check --file "$HOME/tanaab/emori/Brewfile" --no-upgrade

# should create the ssh directory
test -d "$HOME/.ssh"

# should protect the ssh directory permissions
test "$(stat -f '%Lp' "$HOME/.ssh")" = "700"

# should install the default ssh key filename from cli flags
test -f "$HOME/.ssh/id_test"

# should protect the default ssh key permissions
test "$(stat -f '%Lp' "$HOME/.ssh/id_test")" = "600"

# should install the overridden ssh key filename from cli flags
test -f "$HOME/.ssh/id_test_options"

# should protect the overridden ssh key permissions
test "$(stat -f '%Lp' "$HOME/.ssh/id_test_options")" = "600"

# should install the default ssh key material that matches the expected public key
test "$(ssh-keygen -y -f "$HOME/.ssh/id_test" | awk '{print $1 \" \" $2}')" = "$(awk '{print $1 \" \" $2}' id_test.pub)"

# should install the overridden ssh key material that matches the expected public key
test "$(ssh-keygen -y -f "$HOME/.ssh/id_test_options" | awk '{print $1 \" \" $2}')" = "$(awk '{print $1 \" \" $2}' id_test.pub)"

# should clone emori from the local workspace path
test -d "$HOME/tanaab/emori/.git"

# should preserve the emori wrapper entrypoint in the cloned repo
test -f "$HOME/tanaab/emori/boot.sh"

# should point the emori clone origin at the local workspace source
test "$(git -C "$HOME/tanaab/emori" config --get remote.origin.url)" = "$GITHUB_WORKSPACE"

# should clone tanaab canon via ssh by default
test -d "$HOME/tanaab/canon/.git"

# should point the tanaab canon clone at the github ssh remote
test "$(git -C "$HOME/tanaab/canon" config --get remote.origin.url)" = "git@github.com:tanaabased/canon.git"

# should stow representative zsh startup files from the emori checkout
test -L "$HOME/.zshrc"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.zshrc")" = "$HOME/tanaab/emori/dotfiles/zsh/.zshrc"
test -L "$HOME/.zprofile"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.zprofile")" = "$HOME/tanaab/emori/dotfiles/zsh/.zprofile"

# should stow the tanaab plugin link into the target codex plugins directory
test -L "$HOME/.codex/plugins/tanaab"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.codex/plugins/tanaab")" = "$HOME/tanaab/canon"
```

## Destroy tests

```bash
# should remove representative stowed shell startup symlinks
rm -f "$HOME/.zshrc" "$HOME/.zprofile"

# should remove the stowed tanaab plugin link
rm -f "$HOME/.codex/plugins/tanaab"

# should remove the installed example ssh keys
rm -f "$HOME/.ssh/id_test" "$HOME/.ssh/id_test_options"

# should remove the cloned emori and tanaab canon checkouts
rm -rf "$HOME/tanaab/emori" "$HOME/tanaab/canon"
```
