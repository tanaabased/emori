# Agent-scoped host requirements remain here until Agent System can install
# them. Overlap with Agentbox is intentional during this transition; see
# AGENTS.md.

tap "steipete/tap", trusted: true

brew "steipete/tap/imsg"
brew "gh"
brew "git"
brew "openssh"

if Hardware::CPU.arm?
  npm "sqlite-vec-darwin-arm64"
elsif Hardware::CPU.intel?
  npm "sqlite-vec-darwin-x64"
end
