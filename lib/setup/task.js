export default function runSetupTask(mode, handlers) {
  try {
    if (!['check', 'apply'].includes(mode)) {
      throw new Error('Usage: setup task <check|apply>');
    }
    const result = handlers[mode]();
    return mode === 'check' && result !== true ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Setup failed.'}\n`);
    return 2;
  }
}
