import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';

export const dataDir=resolve(process.env.WANDE_DATA_DIR||join(import.meta.dirname,'data'));
mkdirSync(dataDir,{recursive:true});
const sqlite=new DatabaseSync(join(dataDir,'wandeng.sqlite'),{timeout:5000});
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS _wandeng_migrations (name TEXT PRIMARY KEY,hash TEXT NOT NULL)');
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
for(const name of readdirSync(join(import.meta.dirname,'migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
 const sql=readFileSync(join(import.meta.dirname,'migrations',name),'utf8'),hash=digest(sql);
 const previous=sqlite.prepare('SELECT hash FROM _wandeng_migrations WHERE name=?').get(name);
 if(previous){if(previous.hash!==hash)throw Error('Applied migration changed: '+name);continue}
 sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO _wandeng_migrations VALUES (?,?)').run(name,hash);sqlite.exec('COMMIT')}catch(error){sqlite.exec('ROLLBACK');throw error}
}
class Statement {
 constructor(readonly sql:string,readonly values:any[]=[]){ }
 bind(...values:any[]){return new Statement(this.sql,values)}
 async first<T=Record<string,unknown>>(){return (sqlite.prepare(this.sql).get(...this.values)||null) as T|null}
 async all<T=Record<string,unknown>>(){return {success:true,results:sqlite.prepare(this.sql).all(...this.values) as T[]}}
 execute(){const result=sqlite.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
 async run(){return this.execute()}
}
export class Database {
 prepare(sql:string){return new Statement(sql)}
 async batch(statements:Statement[]){
  // ponytail: one SQLite writer per server; move to a shared database before running replicas.
  sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}
 }
}
class FileBucket {
 root=join(dataDir,'files');
 constructor(){mkdirSync(this.root,{recursive:true})}
 async put(key:string,value:Uint8Array|ArrayBuffer,options:{httpMetadata:{contentType:string}}){
  const file=join(this.root,digest(key)),temporary=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,Buffer.from(value as ArrayBuffer),{flag:'wx',mode:0o600});await rename(temporary,file);await writeFile(file+'.json',JSON.stringify(options.httpMetadata),{mode:0o600})}finally{await unlink(temporary).catch(()=>{})}
 }
 async get(key:string){
  const file=join(this.root,digest(key));
  try{const [body,meta]=await Promise.all([readFile(file),readFile(file+'.json','utf8')]);return {body:new Uint8Array(body),httpMetadata:JSON.parse(meta) as {contentType:string}}}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}
 }
 async delete(key:string){for(const suffix of ['', '.json'])await unlink(join(this.root,digest(key))+suffix).catch(error=>{if(error.code!=='ENOENT')throw error})}
}
export const env={DB:new Database(),BUCKET:new FileBucket()};
