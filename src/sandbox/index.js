import { detectSandboxBackends } from './detect.js';
import { ProcessSandbox } from './process-sandbox.js';
import { BubblewrapSandbox } from './bubblewrap-sandbox.js';

export function createSandbox(config = {}) {
  const detected = detectSandboxBackends();
  const requested = config.backend ?? 'auto';
  const selected = requested === 'auto' ? detected.strongestLocal : requested;
  if (selected === 'bubblewrap') {
    if (!detected.bwrap) {
      if (config.requireOsIsolation) throw new Error('bubblewrap requested but unavailable');
      return new ProcessSandbox(config);
    }
    return new BubblewrapSandbox(config);
  }
  if (selected === 'process') {
    if (config.requireOsIsolation) throw new Error('OS isolation required but no supported backend is available');
    return new ProcessSandbox(config);
  }
  throw new Error(`sandbox backend not implemented in this build: ${selected}`);
}

export { detectSandboxBackends, ProcessSandbox, BubblewrapSandbox };
