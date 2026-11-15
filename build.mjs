import {readFile,writeFile,mkdir} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/polish.css':'polish.css','/opportunities.json':'opportunities.json'};
const types={'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','styles.css':'text/css; charset=utf-8','polish.css':'text/css; charset=utf-8','opportunities.json':'application/json; charset=utf-8'};
const assets={};
for(const [path,file] of Object.entries(files))assets[path]={body:await readFile(new URL('dist/'+file,import.meta.url),'utf8'),type:types[file]};
const feed=await readFile(new URL('feed.mjs',import.meta.url),'utf8');
await mkdir(new URL('dist/server/',import.meta.url),{recursive:true});
await writeFile(new URL('dist/server/index.js',import.meta.url),feed+'\nconst assets='+JSON.stringify(assets)+';\n'+
  'export default {async fetch(request){const path=new URL(request.url).pathname;if(path==="/api/fetch"){if(request.method!=="GET")return new Response("Method not allowed",{status:405});const data=await fetchLive();return Response.json(data,{status:data.sources[0].status==="error"?502:200,headers:{"Cache-Control":"no-store"}})}const a=assets[path];return a?new Response(a.body,{headers:{"Content-Type":a.type,"Cache-Control":path==="/opportunities.json"?"no-cache":"public, max-age=0"}}):new Response("Not found",{status:404})}};\n');
