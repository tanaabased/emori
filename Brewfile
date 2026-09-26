# EMORI's dependencies, reconciled by Agent System's brew-dependencies setup step.

tap "steipete/tap", trusted: true
tap "openclaw/tap", trusted: true

brew "steipete/tap/imsg"
brew "gh"
brew "git"
brew "openclaw/tap/gogcli"
brew "openssh"

if Hardware::CPU.arm?
  npm "sqlite-vec-darwin-arm64"
elsif Hardware::CPU.intel?
  npm "sqlite-vec-darwin-x64"
end
