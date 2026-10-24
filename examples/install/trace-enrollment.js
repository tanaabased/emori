import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.env.EMORI_ENROLLMENT_TRACE_FILE) {
  const directory = join(process.env.TMPDIR, `enrollment-loader-${process.pid}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const wrappers = new Map();
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (
        context.parentURL?.startsWith(pathToFileURL(`${directory}/`).href) ||
        (specifier !== '@openclaw/gateway-client' &&
          !resolved.url.includes('/@openclaw/gateway-client/dist/index.mjs'))
      ) {
        return resolved;
      }
      let wrapper = wrappers.get(resolved.url);
      if (!wrapper) {
        const name = createHash('sha256').update(resolved.url).digest('hex');
        wrapper = pathToFileURL(join(directory, `${name}.mjs`)).href;
        writeFileSync(
          new URL(wrapper),
          `import {appendFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {GatewayClient as BaseClient} from ${JSON.stringify(resolved.url)};
export * from ${JSON.stringify(resolved.url)};
const state = Symbol('enrollment trace');
let sequence = 0;
export class GatewayClient extends BaseClient {
  constructor(options) {
    if (options.clientDisplayName !== 'Agent System') {
      super(options);
      return;
    }
    const started = performance.now();
    const client = ++sequence;
    const emit = (event, facts = {}) => {
      try {
        appendFileSync(process.env.EMORI_ENROLLMENT_TRACE_FILE, JSON.stringify({
          at: new Date().toISOString(), pid: process.pid, client,
          elapsedMs: Math.round(performance.now() - started), event, ...facts,
        }) + '\\n', {mode: 0o600});
      } catch { /* Observation must not change the connection outcome. */ }
    };
    const host = options.hostDeps;
    super({
      ...options,
      hostDeps: {
        ...host,
        beforeConnect() {
          emit('before-connect');
          return host?.beforeConnect?.();
        },
        ...(host?.signDevicePayload ? {
          signDevicePayload(...args) {
            const result = host.signDevicePayload(...args);
            emit('challenge-signed');
            return result;
          },
        } : {}),
      },
      onHelloOk(hello) {
        emit('hello');
        return options.onHelloOk?.(hello);
      },
      onConnectError(error) {
        emit('connect-error');
        return options.onConnectError?.(error);
      },
      onClose(code, reason, info) {
        emit('close', {
          code: Number.isInteger(code) && code >= 1000 && code <= 4999 ? code : null,
          phase: ['pre-hello', 'post-hello'].includes(info?.phase) ? info.phase : 'unknown',
          socketOpened: info?.socketOpened === true,
          transportValidated: info?.transportValidated === true,
          connectRequestSent: info?.connectRequestSent === true,
        });
        return options.onClose?.(code, reason, info);
      },
    });
    this[state] = emit;
    emit('created', {auth: options.bootstrapToken ? 'bootstrap' : 'device'});
  }
  start() {
    this[state]?.('start');
    return super.start();
  }
  stopAndWait(options) {
    this[state]?.('shutdown');
    return super.stopAndWait(options);
  }
}
`,
          { mode: 0o600 },
        );
        wrappers.set(resolved.url, wrapper);
      }
      return { ...resolved, url: wrapper, shortCircuit: true };
    },
  });
}
