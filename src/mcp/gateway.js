import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { PolicyBundle } from '../policy-bundle.js';
import { Decision } from '../decision.js';
import { hashObject } from '../canonical.js';
import { DecisionKernel } from '../kernel/decision-kernel.js';
import { ApprovalStore } from '../security/approval-store.js';
import { PersistentLedger } from '../security/persistent-ledger.js';
import { ReceiptSigner } from '../security/receipt-signer.js';
import { CatalogGuard } from './catalog-guard.js';
import { loadAdvisoryProvider } from './advisory-provider.js';

function parseJsonEnv(name, fallback) {
  if (!process.env[name]) return fallback;
  const parsed = JSON.parse(process.env[name]);
  return parsed;
}
function send(v){ process.stdout.write(JSON.stringify(v)+'\n'); }
function reply(id,result){ send({jsonrpc:'2.0',id,result}); }
function replyError(id,code,message,data){ send({jsonrpc:'2.0',id,error:{code,message,...(data===undefined?{}:{data})}}); }

export async function runGateway({
  policyFile = process.env.VEOR_POLICY ?? 'veor.policy.json',
  downstream = parseJsonEnv('VEOR_DOWNSTREAM_JSON', null),
  runtimeDir = process.env.VEOR_RUNTIME_DIR ?? path.join(os.homedir(), '.local', 'state', 'veor', 'gateway'),
  approvalPublicKeyPem = process.env.VEOR_APPROVAL_PUBLIC_KEY && fs.existsSync(process.env.VEOR_APPROVAL_PUBLIC_KEY) ? fs.readFileSync(process.env.VEOR_APPROVAL_PUBLIC_KEY,'utf8') : null,
  receiptPrivateKeyPem = process.env.VEOR_RECEIPT_PRIVATE_KEY && fs.existsSync(process.env.VEOR_RECEIPT_PRIVATE_KEY) ? fs.readFileSync(process.env.VEOR_RECEIPT_PRIVATE_KEY,'utf8') : null,
  advisoryModule = process.env.VEOR_ADVISORY_MODULE ?? null,
} = {}) {
  if (!downstream || !Array.isArray(downstream) || downstream.length === 0) throw new Error('VEOR_DOWNSTREAM_JSON must be a non-empty argv array');
  const policy = PolicyBundle.load(policyFile);
  const ledger = new PersistentLedger({ dir:path.join(runtimeDir,'ledger') });
  const approvals = new ApprovalStore({ dir:path.join(runtimeDir,'approvals'), publicKeyPem:approvalPublicKeyPem });
  const receiptSigner = receiptPrivateKeyPem ? new ReceiptSigner({ privateKeyPem:receiptPrivateKeyPem }) : null;
  const kernel = new DecisionKernel({ policy, approvals, ledger, receiptSigner });
  const catalogGuard = new CatalogGuard({ file:path.join(runtimeDir,'catalog.sha256') });
  const advisory = await loadAdvisoryProvider(advisoryModule, { timeoutMs:Number(process.env.VEOR_ADVISORY_TIMEOUT_MS ?? 100) });

  const child = spawn(downstream[0], downstream.slice(1), { stdio:['pipe','pipe','pipe'], env:process.env, cwd:process.cwd() });
  child.stderr.on('data', c => process.stderr.write(`[downstream] ${c}`));
  let seq = 1000; const pending = new Map(); let tools = []; let catalog = null;
  const childRl = createInterface({ input:child.stdout, crlfDelay:Infinity });
  childRl.on('line', line=>{
    if(!line.trim()) return;
    let m; try{m=JSON.parse(line);}catch{return;}
    if(m.id!=null && pending.has(m.id)){ const p=pending.get(m.id); pending.delete(m.id); p(m); }
  });
  function request(method,params={}) { const id=++seq; return new Promise((resolve,reject)=>{ const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`downstream timeout: ${method}`));},30000); pending.set(id,m=>{clearTimeout(timer);resolve(m)}); child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n'); }); }
  function notify(method,params={}){ child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n'); }
  async function refreshTools(){ const r=await request('tools/list',{}); if(r.error) throw new Error(r.error.message); tools=r.result?.tools??[]; catalog=catalogGuard.check(tools); return r.result; }
  function toolByName(name){ return tools.find(t=>t.name===name); }
  function block(decision){
    const challenge = decision.challenge;
    return { content:[{type:'text',text:`VEOR ${decision.decision}: tool not executed.\n${decision.reasons.map(x=>`- ${x}`).join('\n')}${challenge?`\nChallenge: ${challenge.challengeFile}`:''}`}], structuredContent:{veor:{decision:decision.decision,executed:false,reasons:decision.reasons,capability:decision.capability,argsDigest:decision.record.argsDigest,challenge:challenge?{id:challenge.challengeId,file:challenge.challengeFile,expiresAt:challenge.expiresAt}:null}}, isError:true };
  }
  function veorTools(){return [
    {name:'veor_status',description:'Inspect VEOR policy, catalog integrity, ledger integrity and approval readiness.',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true,idempotentHint:true,openWorldHint:false}},
    {name:'veor_preflight',description:'Evaluate a downstream tool call without executing it or creating an approval.',inputSchema:{type:'object',properties:{tool:{type:'string'},arguments:{type:'object'}},required:['tool']},annotations:{readOnlyHint:true,idempotentHint:true,openWorldHint:false}},
    {name:'veor_receipts',description:'Read recent decision/receipt ledger records without raw tool arguments.',inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100}}},annotations:{readOnlyHint:true,idempotentHint:true,openWorldHint:false}},
  ];}

  const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
  rl.on('line', async line=>{
    if(!line.trim()) return;
    let m; try{m=JSON.parse(line);}catch{return send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}})}
    const {id,method,params}=m;
    try {
      if(String(method||'').startsWith('notifications/')){notify(method,params??{});return;}
      if(method==='initialize'){
        const r=await request(method,params??{}); if(r.error)return replyError(id,r.error.code,r.error.message,r.error.data);
        return reply(id,{...r.result,serverInfo:{name:'veor-gateway',title:'VEOR governed execution boundary',version:'0.4.0'},instructions:`VEOR policy ${policy.digest.slice(0,12)} is active. ${r.result?.instructions??''}`});
      }
      if(method==='tools/list') { const r=await refreshTools(); return reply(id,{...r,tools:[...veorTools(),...(r.tools??[])]}); }
      if(method==='tools/call') {
        const name=params?.name; const args=params?.arguments??{};
        if(name==='veor_status') return reply(id,{content:[{type:'text',text:JSON.stringify({policyDigest:policy.digest,catalog,ledger:ledger.verify(),advisoryConfigured:advisory.configured,approvalKeyPresent:!!approvalPublicKeyPem,receiptSigning:!!receiptPrivateKeyPem},null,2)}],structuredContent:{policyDigest:policy.digest,catalog,ledger:ledger.verify(),advisoryConfigured:advisory.configured,approvalKeyPresent:!!approvalPublicKeyPem,receiptSigning:!!receiptPrivateKeyPem},isError:false});
        if(name==='veor_receipts') { const value={ledger:ledger.verify(),records:ledger.tail(args.limit??20)}; return reply(id,{content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value,isError:false}); }
        if(!tools.length) await refreshTools();
        const tool=toolByName(name);
        if(name==='veor_preflight') {
          const target=toolByName(args.tool); if(!target) return reply(id,{content:[{type:'text',text:'DENY: unknown tool'}],structuredContent:{decision:'DENY',reasons:['UNKNOWN_TOOL'],executed:false},isError:false});
          const advice=await advisory.assess({tool:target,args:args.arguments??{},policyDigest:policy.digest});
          const value=policy.evaluateTool({tool:target,args:args.arguments??{},advisoryDecision:advice.decision,catalogFingerprint:catalog?.current});
          return reply(id,{content:[{type:'text',text:JSON.stringify({...value,advisoryReasons:advice.reasons,executed:false},null,2)}],structuredContent:{...value,advisoryReasons:advice.reasons,executed:false},isError:false});
        }
        if(!tool) return reply(id,block({decision:'DENY',reasons:['UNKNOWN_TOOL'],capability:'unknown',record:{argsDigest:hashObject(args)}}));
        const advice=await advisory.assess({tool,args,policyDigest:policy.digest});
        const decision=kernel.decide({tool,args,advisoryDecision:advice.decision,catalogFingerprint:catalog?.current});
        decision.reasons.push(...advice.reasons.map(r=>`ADVISORY_REASON:${r}`));
        if(decision.decision!==Decision.ALLOW) return reply(id,block(decision));
        const downstreamResult=await request('tools/call',params??{});
        const digest=hashObject(downstreamResult.result??downstreamResult.error??null);
        const signedReceipt=kernel.receipt({decisionRecord:decision.record,resultDigest:digest,executed:true,verified:null,sandbox:null});
        if(downstreamResult.error) return replyError(id,downstreamResult.error.code,downstreamResult.error.message,{...downstreamResult.error.data,veorReceipt:signedReceipt});
        const resultValue={...downstreamResult.result,veorReceipt:signedReceipt};
        return reply(id,resultValue);
      }
      const r=await request(method,params??{}); if(r.error)return replyError(id,r.error.code,r.error.message,r.error.data); return reply(id,r.result);
    } catch(error) { ledger.append('gateway-error',{method,error:error.message}); if(id!==undefined) replyError(id,-32603,`VEOR gateway error: ${error.message}`); }
  });
  rl.on('close',()=>{ try{child.stdin.end()}catch{}; try{child.kill('SIGTERM')}catch{} });
  for (const sig of ['SIGINT','SIGTERM']) {
    process.on(sig, () => {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      process.exit(0);
    });
  }
  process.stderr.write(`[veor] gateway ready policy=${policy.digest.slice(0,12)} downstream=${JSON.stringify(downstream)}\n`);
}
