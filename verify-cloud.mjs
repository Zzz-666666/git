import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('.runtime',{recursive:true});
await build({entryPoints:['app/cloud-bucket.ts'],outfile:'.runtime/bucket.mjs',bundle:true,platform:'node',format:'esm'});
const {CloudBucket}=await import('./.runtime/bucket.mjs');
const realFetch=globalThis.fetch,requests=[];
const key='server-only-test-key',file='voice/'+crypto.randomUUID()+'/'+crypto.randomUUID();
let isPublic=false;
globalThis.fetch=async(url,options)=>{
 requests.push({url,options});assert.equal(options.headers.get('apikey'),key);assert.equal(options.headers.get('authorization'),'Bearer '+key);assert.equal(options.redirect,'error');
 if(url.includes('/bucket/'))return Response.json({public:isPublic});
 if(options.method==='POST')return Response.json({Key:file});
 if(options.method==='DELETE'){assert.deepEqual(JSON.parse(options.body),{prefixes:[file]});return Response.json([])}
 return new Response('voice-bytes',{headers:{'content-type':'audio/mp4'}});
};
try{
 const bucket=new CloudBucket('https://test.supabase.co',key,'wandeng-private');await bucket.verifyPrivate();
 await bucket.put(file,new TextEncoder().encode('voice-bytes'),{httpMetadata:{contentType:'audio/mp4'}});
 assert.equal(new TextDecoder().decode((await bucket.get(file)).body),'voice-bytes');await bucket.delete(file);
 isPublic=true;await assert.rejects(()=>bucket.verifyPrivate(),/public/);
 await assert.rejects(()=>bucket.get('../../private'),/Invalid/);
 assert.throws(()=>new CloudBucket('http://test.supabase.co',key,'wandeng-private'),/HTTPS/);
}finally{globalThis.fetch=realFetch}
await build({entryPoints:['server.ts'],outfile:'.runtime/cloud-test-server.mjs',bundle:true,platform:'node',format:'esm',external:['@electric-sql/pglite'],plugins:[{name:'test-storage',setup(b){b.onResolve({filter:/storage$/},args=>{if(args.path==='./app/storage'||args.path==='../../storage')return {path:resolve('test-cloud-env.ts')}})}}]});
console.log('PASS: private cloud bucket, server-only credentials, upload/download/delete, path validation and HTTPS. PostgreSQL API test server built.');
