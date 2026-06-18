# Envvars Example

This example keeps coverage on the shell-facing environment variable contract of `boot.sh`. It runs
the wrapper with environment variables, delegates into bootbox, and then verifies that the
requested SSH keys were installed, that `emori` was materialized from a local checkout, and that
the post-fetch bootbox apply step used the `emori` checkout's brewfile and dotpkgs on the default target
directory. It also verifies that the default `EMORI_TANAAB=ssh` flow materialized canon and stowed
the `tanaab` plugin link through the `ai` dotpkg, while still covering the wrapper-specific
behavior of allowing force mode to overwrite an existing destination key.

This scenario is intended to run in CI by default. Do not run it locally unless the task explicitly
calls for a local Leia run.

## Setup

```bash
# should remove a core formula first
brew uninstall --formula --force stow || true

# should prepare the default ssh target directory
mkdir -p "$HOME/.ssh"

# should prepare a temp directory for signing checks
mkdir -p .tmp

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

# should run boot.sh successfully using envvars and force-overwrite a conflicting key
printf '%s\n' 'not-a-private-key' > "$HOME/.ssh/id_test_envvars"
chmod 600 "$HOME/.ssh/id_test_envvars"
EMORI_OP_TOKEN="$OPTOKEN" \
EMORI_IDENTITY='EMORI <emori-env@example.test>' \
EMORI_FORCE=1 \
EMORI_SSH_KEY='omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
EMORI_SSH_KEYS='omfsw2uztmi2xqpid5g3kiv6ba/id_test:id_test_envvars' \
EMORI_SIGNING_KEY='omfsw2uztmi2xqpid5g3kiv6ba/id_test:id_test_signing_envvars' \
EMORI_SOURCE="$GITHUB_WORKSPACE" \
EMORI_SKIP_OPENCLAW=1 \
boot.sh
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

# should seed GitHub SSH known hosts
grep -qxF 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' "$HOME/.ssh/known_hosts"
grep -qxF 'github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=' "$HOME/.ssh/known_hosts"
grep -qxF 'github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=' "$HOME/.ssh/known_hosts"

# should install the default ssh key filename from envvars
test -f "$HOME/.ssh/id_test"

# should protect the default ssh key permissions
test "$(stat -f '%Lp' "$HOME/.ssh/id_test")" = "600"

# should install the overridden ssh key filename from envvars
test -f "$HOME/.ssh/id_test_envvars"

# should protect the overridden ssh key permissions
test "$(stat -f '%Lp' "$HOME/.ssh/id_test_envvars")" = "600"

# should install the signing ssh key filename from envvars
test -f "$HOME/.ssh/id_test_signing_envvars"

# should protect the signing ssh key permissions
test "$(stat -f '%Lp' "$HOME/.ssh/id_test_signing_envvars")" = "600"

# should install the default ssh key material that matches the expected public key
test "$(ssh-keygen -y -f "$HOME/.ssh/id_test" | awk '{print $1 \" \" $2}')" = "$(awk '{print $1 \" \" $2}' id_test.pub)"

# should install the overridden ssh key material that matches the expected public key
test "$(ssh-keygen -y -f "$HOME/.ssh/id_test_envvars" | awk '{print $1 \" \" $2}')" = "$(awk '{print $1 \" \" $2}' id_test.pub)"

# should install the signing ssh key material that matches the expected public key
test "$(ssh-keygen -y -f "$HOME/.ssh/id_test_signing_envvars" | awk '{print $1 \" \" $2}')" = "$(awk '{print $1 \" \" $2}' id_test.pub)"

# should write the signing public key next to the private key
test -f "$HOME/.ssh/id_test_signing_envvars.pub"
test "$(awk '{print $1 \" \" $2}' "$HOME/.ssh/id_test_signing_envvars.pub")" = "$(awk '{print $1 \" \" $2}' id_test.pub)"

# should write generated ssh identities in the emori checkout from envvars
ssh_identities_source="$HOME/tanaab/emori/dotfiles/ssh/.config/emori/ssh.identities"
test -f "$ssh_identities_source"
grep -qxF 'Host *' "$ssh_identities_source"
grep -qxF '    IdentityFile ~/.ssh/id_test' "$ssh_identities_source"
grep -qxF '    IdentityFile ~/.ssh/id_test_envvars' "$ssh_identities_source"
grep -qxF '    IdentityFile ~/.ssh/id_test_signing_envvars' "$ssh_identities_source"
test "$(grep -c '^    IdentityFile ' "$ssh_identities_source")" = "3"
! grep -F 'id_emori' "$ssh_identities_source"

# should stow generated ssh identities into the emori config directory
test -e "$HOME/.config/emori/ssh.identities"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.config/emori/ssh.identities")" = "$ssh_identities_source"
cmp -s "$ssh_identities_source" "$HOME/.config/emori/ssh.identities"

# should write generated git identity in the emori checkout from envvars
git_user_source="$HOME/tanaab/emori/dotfiles/git/.config/emori/git-user.inc"
test -f "$git_user_source"
test "$(git config --file "$git_user_source" --get user.name)" = "EMORI"
test "$(git config --file "$git_user_source" --get user.email)" = "emori-env@example.test"

# should stow generated git identity into the emori config directory
test -e "$HOME/.config/emori/git-user.inc"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.config/emori/git-user.inc")" = "$git_user_source"
cmp -s "$git_user_source" "$HOME/.config/emori/git-user.inc"

# should resolve git identity through the stowed global config
test "$(GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$HOME" config --get user.name)" = "EMORI"
test "$(GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$HOME" config --get user.email)" = "emori-env@example.test"

# should write generated git signing config in the emori checkout from envvars
git_signers_source="$HOME/tanaab/emori/dotfiles/git/.config/emori/git-signers.inc"
allowed_signers_source="$HOME/tanaab/emori/dotfiles/git/.config/emori/allowed_signers"
expected_signing_public_key="$(awk '{print $1 \" \" $2}' id_test.pub)"
test -f "$git_signers_source"
test -f "$allowed_signers_source"
test "$(git config --file "$git_signers_source" --get user.signingKey)" = "~/.ssh/id_test_signing_envvars.pub"
test "$(git config --file "$git_signers_source" --get gpg.format)" = "ssh"
test "$(git config --file "$git_signers_source" --get commit.gpgsign)" = "true"
test "$(git config --file "$git_signers_source" --get gpg.ssh.allowedSignersFile)" = "~/.config/emori/allowed_signers"
grep -qxF '# Generated by boot.sh for id_test_signing_envvars' "$allowed_signers_source"
grep -qxF "id_test_signing_envvars $expected_signing_public_key" "$allowed_signers_source"
test "$(grep -cv '^#' "$allowed_signers_source")" = "1"

# should stow generated git signing config into the emori config directory
test -e "$HOME/.config/emori/git-signers.inc"
test -e "$HOME/.config/emori/allowed_signers"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.config/emori/git-signers.inc")" = "$git_signers_source"
test "$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$HOME/.config/emori/allowed_signers")" = "$allowed_signers_source"
cmp -s "$git_signers_source" "$HOME/.config/emori/git-signers.inc"
cmp -s "$allowed_signers_source" "$HOME/.config/emori/allowed_signers"

# should resolve git signing config through the stowed global config
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$HOME" config --get user.signingKey | grep -Fx '~/.ssh/id_test_signing_envvars.pub'
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$HOME" config --get gpg.format | grep -Fx 'ssh'
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$HOME" config --get commit.gpgsign | grep -Fx 'true'
GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$HOME" config --get gpg.ssh.allowedSignersFile | grep -Fx '~/.config/emori/allowed_signers'

# should create and verify a signed empty commit without ssh-agent
signed_repo="$HOME/emori-signing-envvars"
rm -rf "$signed_repo"
git init "$signed_repo"
env -u SSH_AUTH_SOCK GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$signed_repo" commit --allow-empty -m 'signed envvars test'
env -u SSH_AUTH_SOCK GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$HOME/.gitconfig" git -C "$signed_repo" log -1 --show-signature --format='%G? %GS' > .tmp/signed-envvars.log 2>&1
grep -F 'Good "git" signature for id_test_signing_envvars' .tmp/signed-envvars.log
grep -qxF 'G id_test_signing_envvars' .tmp/signed-envvars.log

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

# should remove the stowed generated ssh identities file
rm -f "$HOME/.config/emori/ssh.identities"

# should remove the stowed generated git identity file
rm -f "$HOME/.config/emori/git-user.inc"

# should remove the stowed generated git signing files
rm -f "$HOME/.config/emori/git-signers.inc" "$HOME/.config/emori/allowed_signers"

# should remove the signed commit test repo and log
rm -rf "$HOME/emori-signing-envvars" .tmp

# should remove the installed example ssh keys
rm -f "$HOME/.ssh/id_test" "$HOME/.ssh/id_test_envvars" "$HOME/.ssh/id_test_signing_envvars" "$HOME/.ssh/id_test_signing_envvars.pub"

# should remove the cloned emori and tanaab canon checkouts
rm -rf "$HOME/tanaab/emori" "$HOME/tanaab/canon"
```
