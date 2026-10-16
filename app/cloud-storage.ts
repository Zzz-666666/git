import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {PostgresDatabase} from './cloud-database';
import {CloudBucket} from './cloud-bucket';

export async function cloudEnvironment(){
 const connectionString=process.env.DATABASE_URL,url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!connectionString||!url||!key)throw Error('Cloud storage requires DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
 const parsed=new URL(connectionString);if(!['postgres:','postgresql:'].includes(parsed.protocol))throw Error('Invalid database connection protocol');
 for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])parsed.searchParams.delete(name);
 pg.types.setTypeParser(20,(value:string)=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Database integer outside safe range');return n});
 const pool=new pg.Pool({connectionString:parsed.href,max:4,connectionTimeoutMillis:15000,idleTimeoutMillis:30000,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA?{ca:process.env.DATABASE_CA}:{})}});
 pool.on('error',()=>console.error('Database connection interrupted'));
 const client=await pool.connect();let failure:unknown;
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(82471209)');
  await client.query(await readFile(new URL('./cloud-schema.sql',import.meta.url),'utf8'));await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');failure=error}finally{client.release()}
 if(failure){await pool.end();throw failure}
 const bucket=new CloudBucket(url,key,process.env.SUPABASE_BUCKET||'wandeng-private');await bucket.verifyPrivate();
 return {DB:new PostgresDatabase(()=>pool.connect()),BUCKET:bucket};
}
