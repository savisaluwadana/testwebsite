import {createServer} from 'node:http';
import worker from './dist/server/index.js';
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{
 try{const response=await worker.fetch(new Request('http://localhost:'+port+req.url,{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(502);res.end('Source unavailable')}
}).listen(port,'0.0.0.0',()=>console.log('Competition Radar listening on '+port));
