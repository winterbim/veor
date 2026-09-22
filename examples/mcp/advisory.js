export function assess({tool,args}) {
  if(tool.name.includes('delete')) return {decision:'DENY',reasons:['semantic delete risk']};
  if(tool.annotations?.readOnlyHint===false) return {decision:'REVIEW',reasons:['side-effecting tool']};
  if(JSON.stringify(args).toLowerCase().includes('production')) return {decision:'REVIEW',reasons:['production-like argument']};
  return {decision:'ALLOW',reasons:[]};
}
