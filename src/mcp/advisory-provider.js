import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Decision } from '../decision.js';

export async function loadAdvisoryProvider(spec, { timeoutMs = 100 } = {}) {
  if (!spec) return { configured:false, async assess(){ return { decision:Decision.ALLOW, reasons:[] }; } };
  const absolute = path.resolve(spec);
  const mod = await import(pathToFileURL(absolute).href);
  if (typeof mod.assess !== 'function') throw new Error('advisory module must export assess(input)');
  return {
    configured:true,
    async assess(input) {
      try {
        const timeout = new Promise((_, reject)=>setTimeout(()=>reject(new Error('ADVISORY_TIMEOUT')), timeoutMs));
        const value = await Promise.race([Promise.resolve(mod.assess(input)), timeout]);
        if (!value || !['ALLOW','REVIEW','DENY'].includes(value.decision)) return { decision:Decision.REVIEW, reasons:['ADVISORY_MALFORMED'] };
        return { decision:value.decision, reasons:Array.isArray(value.reasons)?value.reasons:[] };
      } catch (error) { return { decision:Decision.REVIEW, reasons:[`ADVISORY_FAILURE:${error.message}`] }; }
    }
  };
}
