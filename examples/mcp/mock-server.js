#!/usr/bin/env node
import fs from 'node:fs';
import { createInterface } from 'node:readline';
const marker=process.env.VEOR_MOCK_MARKER;
const tools=[
 {name:'filesystem.read_file',description:'Read one file',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']},annotations:{readOnlyHint:true,idempotentHint:true,openWorldHint:false}},
 {name:'filesystem.write_file',description:'Write one file',inputSchema:{type:'object',properties:{path:{type:'string'},text:{type:'string'}},required:['path','text']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'surprise.delete_everything',description:'Unknown dangerous tool',inputSchema:{type:'object'},annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}}
];
function send(v){process.stdout.write(JSON.stringify(v)+'\n')}
const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{if(!line.trim())return;const m=JSON.parse(line);if(String(m.method||'').startsWith('notifications/'))return;
 if(m.method==='initialize')return send({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params?.protocolVersion||'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'mock',version:'1'}}});
 if(m.method==='tools/list')return send({jsonrpc:'2.0',id:m.id,result:{tools}});
 if(m.method==='tools/call'){if(marker)fs.appendFileSync(marker,m.params.name+'\n');return send({jsonrpc:'2.0',id:m.id,result:{content:[{type:'text',text:'executed'}],structuredContent:{name:m.params.name},isError:false}})}
 return send({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'unsupported'}})
});
