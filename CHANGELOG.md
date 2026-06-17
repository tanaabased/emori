## {{ UNRELEASED_VERSION }} - [{{ UNRELEASED_DATE }}]({{ UNRELEASED_LINK }})

## v1.0.0-beta.5 - [June 17, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.5)

- Fixed hosted bootstrap confirmation to read from `/dev/tty` when `stdin` is piped. [#11](https://github.com/tanaabased/emori/pull/11)
- Updated README hosted and local `bootemori` usage guidance. [#11](https://github.com/tanaabased/emori/pull/11)

## v1.0.0-beta.4 - [June 17, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.4)

- Added GitHub SSH `known_hosts` seeding before SSH clones. [#9](https://github.com/tanaabased/emori/pull/9)
- Added quiet, no-sudo bootbox delegation for EMORI bootstrap. [#9](https://github.com/tanaabased/emori/pull/9)
- Updated bootbox delegation to use the `BOOTBOX_*` namespace. [#9](https://github.com/tanaabased/emori/pull/9)

## v1.0.0-beta.3 - [June 17, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.3)

- Added agentbox brewgroup remediation for Homebrew prefix failures. [#8](https://github.com/tanaabased/emori/pull/8)
- Added Homebrew cask appdir policy for `~/Applications`. [#8](https://github.com/tanaabased/emori/pull/8)
- Added Homebrew prefix access guard in `boot.sh`. [#8](https://github.com/tanaabased/emori/pull/8)
- Removed Tailscale from EMORI-owned dependencies. [#8](https://github.com/tanaabased/emori/pull/8)
- Updated desktop app readiness to prefer `~/Applications`. [#8](https://github.com/tanaabased/emori/pull/8)

## v1.0.0-beta.2 - [June 16, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.2)

- Added initial OpenClaw bootstrapping. [#6](https://github.com/tanaabased/emori/pull/6)

## v1.0.0-beta.1 - [June 6, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.1)

- Initial EMORI beta release.
