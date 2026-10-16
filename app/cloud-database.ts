import type {Database,Statement} from './storage';

// Only application-owned SQL reaches here; user input stays in bound values.
export function postgresSQL(input:string){
 let index=0;
 let sql=input.replace(/\bINSERT OR IGNORE INTO\b/gi,'INSERT INTO').replace(/\?/g,()=>'$'+(++index));
 if(/\bINSERT OR IGNORE INTO\b/i.test(input))sql+=' ON CONFLICT DO NOTHING';
 return sql.replace(/\bas spaceName\b/gi,'AS "spaceName"').replace(/\bas hasAudio\b/gi,'AS "hasAudio"');
}
type Connection={query(sql:string,values?:any[]):Promise<{rows:any[];rowCount?:number|null}>;release?:()=>void};
export class PostgresDatabase implements Database {
 constructor(readonly connect:()=>Promise<Connection>){ }
 prepare(sql:string):Statement{
  const database=this;
  return {sql,values:[],bind(...values:any[]){const s=database.prepare(sql);s.values=values;return s},async first<T>(){return (await database.execute([this]))[0].rows[0] as T||null},async all<T>(){return {success:true,results:(await database.execute([this]))[0].rows as T[]}},async run(){const result=(await database.execute([this]))[0];return {success:true,meta:{changes:result.rowCount||0}}}};
 }
 async execute(statements:Statement[]){
  const client=await this.connect();
  try{
   await client.query('BEGIN');await client.query('SET LOCAL search_path TO wandeng,pg_catalog');
   const results=[];for(const statement of statements)results.push(await client.query(postgresSQL(statement.sql),statement.values));
   await client.query('COMMIT');return results;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release?.()}
 }
 async batch(statements:Statement[]){return (await this.execute(statements)).map(result=>({success:true,meta:{changes:result.rowCount||0}}))}
}
