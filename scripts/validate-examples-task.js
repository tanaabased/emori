import { compileHarness, find, parse } from '@lando/leia/compiler';

const harnesses = parse(find(['examples/*/README.md']), { retry: 0 });

for (const harness of harnesses) {
  compileHarness(harness);
}

process.stdout.write(`Validated ${harnesses.length} Leia scenarios without executing commands.\n`);
