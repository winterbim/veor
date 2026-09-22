export class InMemoryExecutor {
  constructor(initial = { notes: [] }) {
    this.state = structuredClone(initial);
  }

  async execute(proposal) {
    const before = structuredClone(this.state);

    if (proposal.tool === 'notes.append') {
      if (typeof proposal.args?.text !== 'string' || proposal.args.text.length === 0) {
        return { ok: false, code: 'INVALID_ARGUMENT', before, after: structuredClone(this.state) };
      }
      this.state.notes ??= [];
      this.state.notes.push(proposal.args.text);
      return { ok: true, code: 'OK', before, after: structuredClone(this.state) };
    }

    if (proposal.tool === 'notes.deleteAll') {
      this.state.notes = [];
      return { ok: true, code: 'OK', before, after: structuredClone(this.state) };
    }

    return { ok: false, code: 'UNKNOWN_TOOL', before, after: structuredClone(this.state) };
  }
}

export async function verifyPostcondition(receipt, verifier) {
  if (typeof verifier !== 'function') {
    return { verified: false, reason: 'NO_POSTCONDITION_VERIFIER' };
  }
  try {
    const result = await verifier(receipt);
    if (result === true) return { verified: true, reason: 'VERIFIED' };
    if (result && typeof result === 'object' && typeof result.verified === 'boolean') return result;
    return { verified: false, reason: 'POSTCONDITION_FALSE' };
  } catch (error) {
    return { verified: false, reason: 'VERIFIER_ERROR', error: error.message };
  }
}
