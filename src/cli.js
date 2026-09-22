#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createAuthority } from './grants.js';
import { generateApprovalAuthority, signChallenge } from './security/approval-store.js';
import { generateReceiptAuthority } from './security/receipt-signer.js';
import { verifyLedgerDir, verifyReceiptFile } from './security/receipt-verify.js';
import { detectSandboxBackends, createSandbox } from './sandbox/index.js';
import { runGateway } from './mcp/gateway.js';

const args=process.argv.slice(2); const cmd=args[0];
function value(flag){const i=args.indexOf(flag);return i>=0?args[i+1]:null}
function writeSecure(file,body,mode=0o600){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,body,{mode})}
function usage(){console.log(`VEOR 0.4.0 developer preview\n\nCommands:\n  keygen grant\n  keygen approval --private FILE --public FILE\n  keygen receipt --private FILE --public FILE\n  approve CHALLENGE --private FILE\n  verify receipt FILE --public KEY [--ledger DIR]\n  verify ledger DIR\n  receipt verify FILE --public KEY [--ledger DIR]\n  sandbox-info\n  sandbox --cwd DIR -- command arg...\n  mcp --policy FILE -- downstream arg...\n\nExit codes for verify: 0 if proof holds, 1 otherwise. Output is stable JSON.\n`)}

function runVerifyReceipt(receiptFile, publicFile) {
  if (!receiptFile || !publicFile) throw new Error('verify receipt requires FILE and --public KEY');
  const out = verifyReceiptFile(receiptFile, publicFile, { ledgerDir: value('--ledger') });
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.ok ? 0 : 1;
}

if(cmd==='keygen'&&args[1]==='grant'){console.log(JSON.stringify(createAuthority(),null,2));}
else if(cmd==='keygen'&&(args[1]==='approval'||args[1]==='receipt')){
  const priv=value('--private'),pub=value('--public');if(!priv||!pub)throw new Error('--private and --public are required');
  const pair=args[1]==='approval'?generateApprovalAuthority():generateReceiptAuthority();writeSecure(priv,pair.privateKeyPem);writeSecure(pub,pair.publicKeyPem,0o644);console.log(JSON.stringify({ok:true,private:path.resolve(priv),public:path.resolve(pub)},null,2));
}
else if(cmd==='approve'){
  const challengeFile=args[1],priv=value('--private');if(!challengeFile||!priv)throw new Error('approve requires challenge file and --private');const challenge=JSON.parse(fs.readFileSync(challengeFile,'utf8'));const signed=signChallenge(challenge,fs.readFileSync(priv,'utf8'));writeSecure(challenge.approvalFile,JSON.stringify(signed,null,2));console.log(JSON.stringify({ok:true,challengeId:challenge.challengeId,approvalFile:challenge.approvalFile},null,2));
}
else if(cmd==='verify'&&args[1]==='receipt'){runVerifyReceipt(args[2],value('--public'));}
else if(cmd==='verify'&&args[1]==='ledger'){
  const dir=args[2]; if(!dir)throw new Error('verify ledger requires DIR');
  const out=verifyLedgerDir(dir); console.log(JSON.stringify(out,null,2)); process.exitCode=out.ok?0:1;
}
else if(cmd==='receipt'&&args[1]==='verify'){runVerifyReceipt(args[2],value('--public'));}
else if(cmd==='sandbox-info'){console.log(JSON.stringify(detectSandboxBackends(),null,2));}
else if(cmd==='sandbox'){
  const sep=args.indexOf('--');if(sep<0)throw new Error('sandbox command requires -- before argv');const argv=args.slice(sep+1);const cwd=value('--cwd')??process.cwd();const sandbox=createSandbox({backend:value('--backend')??'auto',workspace:cwd,readRoots:[cwd],writeRoots:[cwd],network:value('--network')??'deny',requireOsIsolation:args.includes('--require-os-isolation')});const out=await sandbox.exec(argv,{cwd});console.log(JSON.stringify(out,null,2));process.exitCode=out.ok?0:1;
}
else if(cmd==='mcp'){
  const sep=args.indexOf('--');if(sep<0)throw new Error('mcp requires -- before downstream command');const downstream=args.slice(sep+1);const policyFile=value('--policy')??'veor.policy.json';await runGateway({policyFile,downstream});
}
else usage();
