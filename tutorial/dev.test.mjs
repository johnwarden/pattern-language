import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';

// Host tooling needs an HTTP test: source-language cases cannot observe the
// local server, browser bundles or Markdown rebuilds.
test('local tour serves live Markdown and the native interpreter',{timeout:30000},async()=>{
 const child=spawn(process.execPath,[new URL('dev.mjs',import.meta.url).pathname,'0'],{stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});
 const page=new URL('pages/01-a-typed-rectangle.md',import.meta.url);
 const original=await readFile(page,'utf8');
 async function until(fn){const deadline=Date.now()+15000;while(Date.now()<deadline){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+log);}
 try{
  const origin=await until(()=>log.match(/Tour: (http:\/\/127\.0\.0\.1:\d+)/)?.[1]);
  const html=await fetch(origin).then(r=>r.text());assert.match(html,/A Short Tour/);
  let app=await fetch(origin+'/app.js').then(r=>r.text());assert.match(app,/A typed Rectangle/);assert.match(app,/types-are-values/);
  assert.match(await fetch(origin+'/app.css').then(r=>r.text()),/\.sidebar/);
  const worker=await fetch(origin+'/tour-worker.js').then(r=>r.text());
  const messages=[];const context=vm.createContext({performance,console,postMessage:value=>messages.push(value)});vm.runInContext(worker,context);
  context.onmessage({data:{requestId:1,source:'def Rectangle type :Rect(width :: Int, height :: Int)\nr = Rect(3, 4) :: Rectangle\nr.width * r.height'}});
  assert.equal(messages[0].status,'success',messages[0].message);assert.equal(messages[0].output,'12 :: Int');
  await writeFile(page,original+'\nTour rebuild smoke marker.\n');
  await until(async()=>{app=await fetch(origin+'/app.js').then(r=>r.text());return app.includes('Tour rebuild smoke marker.');});
 }finally{await writeFile(page,original);child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
});
