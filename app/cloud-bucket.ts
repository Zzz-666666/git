export class CloudBucket {
 readonly root:string;
 constructor(url:string,readonly key:string,readonly bucket:string){
  const origin=new URL(url);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/')throw Error('Storage requires an HTTPS project origin');
  if(!/^[a-z0-9-]{1,63}$/.test(bucket))throw Error('Invalid storage bucket');this.root=origin.origin+'/storage/v1';
 }
 private async request(path:string,options:RequestInit={}){
  const headers=new Headers(options.headers);headers.set('apikey',this.key);headers.set('Authorization','Bearer '+this.key);
  return fetch(this.root+path,{...options,headers,redirect:'error',signal:AbortSignal.timeout(20000)});
 }
 private path(key:string){if(!/^(voice|avatars)\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key))throw Error('Invalid stored file key');return '/object/'+this.bucket+'/'+key}
 async verifyPrivate(){
  const response=await this.request('/bucket/'+this.bucket);if(!response.ok)throw Error('Create a private Supabase bucket named '+this.bucket+' before starting');
  if((await response.json()).public!==false)throw Error('Refusing public storage bucket');
 }
 async put(key:string,value:Uint8Array|ArrayBuffer,options:{httpMetadata:{contentType:string}}){
  const response=await this.request(this.path(key),{method:'POST',headers:{'Content-Type':options.httpMetadata.contentType,'x-upsert':'false'},body:new Uint8Array(value as ArrayBuffer)});
  if(!response.ok)throw Error('File storage unavailable ('+response.status+')');
 }
 async get(key:string){
  const response=await this.request(this.path(key));
  if(!response.ok){if(response.status===404)return null;const error=await response.json().catch(()=>null);if(error?.statusCode==='404'||error?.statusCode===404)return null;throw Error('File download unavailable ('+response.status+')')}
  return {body:new Uint8Array(await response.arrayBuffer()),httpMetadata:{contentType:response.headers.get('content-type')||'application/octet-stream'}};
 }
 async delete(key:string){
  this.path(key);const response=await this.request('/object/'+this.bucket,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});
  if(!response.ok)throw Error('File deletion unavailable ('+response.status+')');
 }
}
