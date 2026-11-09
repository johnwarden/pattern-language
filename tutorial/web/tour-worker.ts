import { Interpreter } from '../../src/runtime.ts';
import { renderDiagnostic } from '../../src/diagnostics.ts';
import { LanguageError } from '../../src/syntax.ts';

type RunRequest={requestId:number;source:string;sourceName?:string};
const host=globalThis as unknown as {onmessage:(event:MessageEvent<RunRequest>)=>void;postMessage:(value:unknown)=>void};

host.onmessage=({data})=>{
  const {requestId,source}=data;
  const sourceName=data.sourceName||'playground.pattern';
  const started=performance.now();
  try{
    // A run is a complete program in a fresh session. Native primitives, grammar,
    // prelude, resource limits and canonical printing stay authoritative.
    const interpreter=new Interpreter();
    const results=interpreter.run(source,'repl',sourceName);
    const output=interpreter.inspect(results);
    host.postMessage({requestId,status:'success',output,resultCount:results.length,duration:performance.now()-started});
  }catch(error){
    const diagnostic=error instanceof LanguageError?error.diagnostic:undefined;
    const span=diagnostic?.primary;
    host.postMessage({
      requestId,status:'error',output:'',message:renderDiagnostic(error),
      diagnostic:diagnostic?{code:diagnostic.code,message:diagnostic.message,phase:diagnostic.phase,line:span?.line,column:span?.column,endLine:span?.endLine,endColumn:span?.endColumn,notes:diagnostic.notes}:undefined,
      duration:performance.now()-started,
    });
  }
};
