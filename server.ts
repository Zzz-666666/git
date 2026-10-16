import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import {GET,POST,DELETE} from './app/api/[...path]/route';

const port=Number(process.env.PORT||8788),host=process.env.HOST||'127.0.0.1';
const configuredValue=process.env.WANDE_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;
const configured=configuredValue?new URL(configuredValue).origin:null;
if(configured&&!configured.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(configured))throw Error('Public service requires HTTPS');
const root=resolve(import.meta.dirname,'client');
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(incoming,outgoing)=>{
 try{
  const requestHost=incoming.headers.host||'';
  if(incoming.url==='/healthz'&&incoming.method==='GET'){outgoing.writeHead(200,{'Content-Type':'text/plain'});outgoing.end('ok');return}
  if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestHost)&&(!configured||requestHost!==new URL(configured).host)){outgoing.writeHead(421);outgoing.end('Unknown service host');return}
  const origin=configured||'http://'+requestHost;
  const url=new URL(incoming.url||'/',origin);
  const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  // Never trust browser-supplied platform identity, proxy origin or client IP headers.
  headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
  const trusted=process.env.WANDE_TRUST_PROXY==='1'&&(process.env.WANDE_TRUSTED_PROXY_IPS||'127.0.0.1,::1,::ffff:127.0.0.1').split(',').includes(incoming.socket.remoteAddress||'');
  const renderIP=process.env.RENDER==='true'?String(incoming.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean).at(-1):null;
  const ip=renderIP||(trusted?(incoming.headers['cf-connecting-ip']||String(incoming.headers['x-forwarded-for']||'').split(',')[0].trim()||incoming.socket.remoteAddress):incoming.socket.remoteAddress);
  headers.set('cf-connecting-ip',String(ip||'unknown'));
  let response:Response;
  if(url.pathname.startsWith('/api/')){
   const method=incoming.method||'GET';
   const request=new Request(url,{method,headers,...(!['GET','HEAD'].includes(method)?{body:Readable.toWeb(incoming) as ReadableStream,duplex:'half'}:{})} as RequestInit);
   const handler=method==='GET'?GET:method==='POST'?POST:method==='DELETE'?DELETE:null;
   response=handler?await handler(request):new Response('Method not allowed',{status:405});
  }else{
   if(!['GET','HEAD'].includes(incoming.method||'')){outgoing.writeHead(405);outgoing.end();return}
   const path=resolve(root,'.'+decodeURIComponent(url.pathname));
   if(path!==root&&!path.startsWith(root+sep)){outgoing.writeHead(404);outgoing.end();return}
   let file=path;
   try{if(!(await stat(file)).isFile())file=join(root,'index.html')}catch{if(extname(path)){outgoing.writeHead(404);outgoing.end();return}file=join(root,'index.html')}
   response=new Response(incoming.method==='HEAD'?null:new Uint8Array(await readFile(file)),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600'}});
  }
  outgoing.statusCode=response.status;
  response.headers.forEach((value,key)=>{if(key!=='set-cookie')outgoing.setHeader(key,value)});
  const cookies=response.headers.getSetCookie();if(cookies.length)outgoing.setHeader('Set-Cookie',cookies);
  outgoing.setHeader('X-Content-Type-Options','nosniff');outgoing.setHeader('Referrer-Policy','same-origin');outgoing.setHeader('X-Frame-Options','DENY');outgoing.setHeader('Permissions-Policy','microphone=(self), camera=(), geolocation=()');
  if(response.body)Readable.fromWeb(response.body as any).pipe(outgoing);else outgoing.end();
 }catch(error){console.error('Request failed:',error instanceof Error?error.message:'unknown');if(!outgoing.headersSent)outgoing.writeHead(500,{'Content-Type':'application/json'});outgoing.end('{"error":"服务暂时不可用"}')}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(port,host,()=>console.log(`晚灯 independent server: ${configured||'http://'+host+':'+port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
