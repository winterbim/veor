import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PolicyBundle } from '../policy-bundle.js';
import { DecisionKernel } from './decision-kernel.js';
import { ApprovalStore } from '../security/approval-store.js';
import { PersistentLedger } from '../security/persistent-ledger.js';
import { ReceiptSigner } from '../security/receipt-signer.js';

export function createKernelService({
  policyFile = process.env.VEOR_POLICY ?? 'veor.policy.json',
  runtimeDir = process.env.VEOR_RUNTIME_DIR ?? path.join(os.homedir(),'.local','state','veor','kernel'),
  approvalPublicKeyFile = process.env.VEOR_APPROVAL_PUBLIC_KEY ?? null,
  receiptPrivateKeyFile = process.env.VEOR_RECEIPT_PRIVATE_KEY ?? null,
} = {}) {
  const policy = PolicyBundle.load(policyFile);
  const approvalPublicKeyPem = approvalPublicKeyFile && fs.existsSync(approvalPublicKeyFile) ? fs.readFileSync(approvalPublicKeyFile,'utf8') : null;
  const receiptPrivateKeyPem = receiptPrivateKeyFile && fs.existsSync(receiptPrivateKeyFile) ? fs.readFileSync(receiptPrivateKeyFile,'utf8') : null;
  const ledger = new PersistentLedger({dir:path.join(runtimeDir,'ledger')});
  const approvals = new ApprovalStore({dir:path.join(runtimeDir,'approvals'),publicKeyPem:approvalPublicKeyPem});
  const receiptSigner = receiptPrivateKeyPem ? new ReceiptSigner({privateKeyPem:receiptPrivateKeyPem}) : null;
  const kernel = new DecisionKernel({policy,approvals,ledger,receiptSigner});
  return {
    policy,ledger,kernel,
    handle(method, params={}) {
      if(method==='ping') return {ok:true};
      if(method==='status') return {policyDigest:policy.digest,ledger:ledger.verify(),approvalKeyPresent:!!approvalPublicKeyPem,receiptSigning:!!receiptPrivateKeyPem};
      if(method==='decide') return kernel.decide(params);
      if(method==='receipt') return kernel.receipt(params);
      throw new Error(`unknown kernel method: ${method}`);
    }
  };
}
