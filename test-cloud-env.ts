// Development-only PostgreSQL engine. Never imported by the production build.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PostgresDatabase} from './app/cloud-database';
const pg=new PGlite();
await pg.exec('BEGIN;'+await readFile(resolve('cloud-schema.sql'),'utf8')+'COMMIT;');
let gate=Promise.resolve();
const DB=new PostgresDatabase(async()=>{
 let unlock!:()=>void;const before=gate;gate=new Promise<void>(resolve=>{unlock=resolve});await before;
 return {query:async(sql:string,values:any[]=[])=>{const result=await pg.query(sql,values);return {rows:result.rows,rowCount:result.affectedRows}},release:unlock};
});
const files=new Map<string,{body:Uint8Array;httpMetadata:{contentType:string}}>();
export const env={DB,BUCKET:{async put(key:string,value:ArrayBuffer,options:{httpMetadata:{contentType:string}}){files.set(key,{body:new Uint8Array(value),httpMetadata:options.httpMetadata})},async get(key:string){return files.get(key)||null},async delete(key:string){files.delete(key)}}};
export const dataDir=resolve('.runtime/test-cloud-data');
