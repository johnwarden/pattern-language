import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const directory=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.argv[2]??4174);
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Port must be an integer between 0 and 65535.');
const digest=createHash('sha256').update(readFileSync(path.join(directory,'package-lock.json'))).digest('hex');
const stamp=path.join(directory,'node_modules/.tour-lock');
if(!existsSync(stamp)||readFileSync(stamp,'utf8')!==digest){
 console.log('Installing locked tutorial dependencies…');
 const install=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--no-audit','--no-fund'],{cwd:directory,stdio:'inherit'});
 if(install.status!==0)process.exit(install.status??1);
 writeFileSync(stamp,digest);
}
const {context}=await import('esbuild');
const outdir=path.join(directory,'.dev');
mkdirSync(outdir,{recursive:true});
writeFileSync(path.join(outdir,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Patterns as Types · A Short Tour</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
const ctx=await context({
 absWorkingDir:directory,
 entryPoints:{app:'web/main.tsx','tour-worker':'web/tour-worker.ts'},outdir,
 bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"development"'},
 plugins:[{name:'tutorial-markdown',setup(build){
  build.onResolve({filter:/^tour:lessons$/},()=>({path:'lessons',namespace:'tutorial'}));
  build.onLoad({filter:/.*/,namespace:'tutorial'},()=>{
   const manifestPath=path.join(directory,'manifest.json');
   const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
   const watchFiles=[manifestPath];
   const lessons=manifest.map(lesson=>{
    if(!/^pages\/[a-z0-9-]+\.md$/.test(lesson.file))throw Error('Invalid lesson path: '+lesson.file);
    const file=path.join(directory,lesson.file);watchFiles.push(file);
    const body=readFileSync(file,'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').trim();
    const examples=[...body.matchAll(/```pattern\r?\n([\s\S]*?)```/g)].map(m=>m[1].replace(/\r?\n$/,''));
    if(!examples.length)throw Error('Missing pattern example: '+lesson.file);
    return {...lesson,body,examples};
   });
   return {contents:'export default '+JSON.stringify(lessons),loader:'js',watchFiles};
  });
 }}],
});
await ctx.watch();
try{
 const server=await ctx.serve({host:'127.0.0.1',port,servedir:outdir});
 console.log(`Tour: http://127.0.0.1:${server.port}`);
 console.log('Watching tutorial Markdown, UI, highlighting grammar and interpreter source. Ctrl+C to stop.');
}catch(error){await ctx.dispose();throw error;}
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await ctx.dispose();process.exit(0);});
