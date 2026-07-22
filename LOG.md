# EMORI Setup Log

Last updated: 2026-07-22

This public-safe running log records additional setup completed after
`openclaw agents add`. It excludes initial installation and agent creation,
audits and plans, troubleshooting, and host-specific workarounds.

Commands are included when useful. Pairing codes, image data, and other private
or unwieldy values are replaced with placeholders.

## 2026-07-21

### iMessage

Configured the named iMessage account `emori`, explicitly bound it to the
`emori` agent, paired Mike, and verified messages and replies end to end.

Added the `imsg` CLI to the workspace Brewfile through its trusted tap so the
channel dependency can be installed repeatably.

Relevant commands used:

```bash
brew bundle install --file Brewfile
openclaw pairing approve imessage <pairing-code> --account emori
openclaw gateway restart
openclaw agents bindings --json
openclaw channels status --channel imessage --json
```

### PIROG Control UI profile

Set Mike's browser-local Control UI identity to `PIROG` with his image encoded
as a data URL.

Browser-console command used:

```javascript
localStorage.setItem(
  'openclaw.control.user.v1',
  JSON.stringify({ name: 'PIROG', avatar: '<data-url>' }),
);
location.reload();
```

This profile is local to the browser and is lost if its site data is cleared.

### OpenAI Realtime voice

Configured Talk with:

- OpenAI Realtime over WebRTC.
- Model `gpt-realtime-2.1` and voice `shimmer`.
- Forced `agent-consult` routing through EMORI.
- Locale `en-US`, interruption on speech, and a 1.2-second silence threshold.
- EMORI-specific voice and delivery instructions.

Relevant commands used, with long instruction payloads omitted:

```bash
openclaw config set --batch-json '<Talk settings batch>' --dry-run
openclaw config set --batch-json '<Talk settings batch>'
openclaw config set \
  talk.realtime.providers.openai.speakerVoice '"shimmer"' --strict-json
openclaw config set talk.realtime.instructions '<voice-instructions>'
openclaw config validate
```

## 2026-07-22

### Heartbeat

Kept EMORI's heartbeat enabled every 30 minutes around the clock using isolated,
lightweight context. Busy work defers a run. Material alerts route to Mike's
private iMessage; acknowledgments and unchanged conditions remain silent.

Relevant commands used, with the private recipient omitted:

```bash
openclaw config set 'agents.list[<emori-index>].heartbeat' \
  '<heartbeat-config-json>' --strict-json
openclaw config validate
```

### Gateway authentication

Moved the Gateway token out of `openclaw.json` into a private file-backed
SecretRef, disabled insecure Control UI authentication, and retained the
loopback-only Gateway behind Tailscale Serve. The only trusted reverse proxy is
the local Tailscale proxy on `127.0.0.1`.

Relevant commands used, with private paths and values omitted:

```bash
mkdir -p <openclaw-state-dir>/secrets
chmod 700 <openclaw-state-dir>/secrets
chmod 600 <gateway-token-file>

openclaw config set --batch-json '<gateway-hardening-settings>' --dry-run
openclaw config set --batch-json '<gateway-hardening-settings>'
openclaw gateway restart
openclaw secrets audit --check
openclaw gateway status --deep
tailscale serve status --json
```

### EMORI messaging permission

Added only the `message` tool to EMORI's existing coding tool profile. This
supports proactive messages and message attachments without broadening the
global tool policy or granting the permission to other agents.

Relevant command used:

```bash
openclaw config set --batch-json \
  '[{"path":"agents.list[<emori-index>].tools.alsoAllow","value":["message"]}]'
```

### Execution approvals

Hardened the Gateway host's execution underlayer from unrestricted execution to
an allowlist with approval on misses. Missing or unreachable approvals fail
closed, and skills do not gain automatic host-execution permission. The
requested `tools.exec.mode` remains `auto`.

Relevant commands used:

```bash
jq \
  '.defaults.security = "allowlist"
   | .defaults.ask = "on-miss"
   | .defaults.askFallback = "deny"
   | .defaults.autoAllowSkills = false' \
  <openclaw-state-dir>/exec-approvals.json \
  | openclaw approvals set --stdin

openclaw exec-policy show --json
```

### Session continuity

Disabled the default daily session rollover by selecting idle reset mode without
an idle timeout. WebChat conversations now continue in the same transcript until
Mike or EMORI explicitly starts or resets a session.

Relevant commands used:

```bash
openclaw config set session.reset '{"mode":"idle"}' --strict-json --dry-run
openclaw config set session.reset '{"mode":"idle"}' --strict-json
openclaw config validate
```

### Codex plugin integrity

Rebuilt the persisted plugin registry after verifying that the installed Codex
plugin resolved to the official `@openclaw/codex` package at the current
version. The reconstructed install record includes npm integrity and shasum
metadata; plugin diagnostics are clean, and the security audit no longer reports
`plugins.installs_missing_integrity`. The protected `main` agent and its OpenAI
OAuth state were retained because EMORI's usable Codex authentication route
currently resolves through that store.

Relevant commands used:

```bash
openclaw plugins update codex --dry-run
openclaw plugins update codex
openclaw plugins registry --refresh
openclaw plugins inspect codex
openclaw plugins doctor
openclaw security audit --deep
openclaw models status --agent emori --json
openclaw gateway status --deep
```

### Temporary Git and SSH identity

Restowed the workspace's `dotfiles` package to provide EMORI's user-scoped Git
identity, SSH commit and tag signing, allowed signer, and GitHub SSH routing.
This package is a temporary authorization bridge, not the durable design.

Once Agent System provides and verifies equivalent per-agent identity and
authorization, unstow these files and remove the `dotfiles` package from this
repository. Do not remove it before the Agent System cutover is proven to
preserve Git authorship, SSH authentication, and signature verification.

Relevant command used:

```bash
stow --restow --no-folding --target="$HOME" dotfiles
```
