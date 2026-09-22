#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { createKernelService } from './service.js';
const service=createKernelService();
const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
function send(v){process.stdout.write(JSON.stringify(v)+'\n')}
rl.on('line',line=>{
  if(!line.trim())return;
  let m;try{m=JSON.parse(line)}catch{return send({id:null,error:{code:'BAD_JSON'}})}
  try{send({id:m.id,result:service.handle(m.method,m.params??{})})}catch(error){send({id:m.id,error:{code:'KERNEL_ERROR',message:error.message}})}
});
