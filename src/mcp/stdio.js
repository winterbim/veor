#!/usr/bin/env node
import { runGateway } from './gateway.js';
runGateway().catch(error=>{ console.error(`[veor] fatal: ${error.stack||error.message}`); process.exit(1); });
