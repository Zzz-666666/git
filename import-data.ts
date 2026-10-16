import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {env,dataDir} from './app/storage';
const source=process.argv[2];if(!source)throw Error('Usage: node import-data.mjs private-export.json');
if((await env.DB.prepare('SELECT COUNT(*) AS n FROM people').first<{n:number}>())?.n){
 if(process.env.WANDE_STORAGE==='cloud')throw Error('Cloud import requires an empty database; back up existing data before any merge.');
 if(!process.argv.includes('--merge'))throw Error('Import requires an empty database, or --merge with a backup.');
 await env.DB.prepare('VACUUM INTO ?').bind(join(dataDir,'before-import-'+Date.now()+'.sqlite')).run();
}
const input=JSON.parse(await readFile(resolve(source),'utf8'));
const tables=['people','accounts','posts','comments','hugs','messages','friendships','follows','notes'];
const statements=[];let total=0;
for(const table of tables){
 const section=input[table];if(!section||!Array.isArray(section.rows))throw Error('Incomplete export: '+table);
 const schema=process.env.WANDE_STORAGE==='cloud'?await env.DB.prepare("SELECT column_name AS name FROM information_schema.columns WHERE table_schema='wandeng' AND table_name=?").bind(table).all<{name:string}>():await env.DB.prepare(`PRAGMA table_info(${table})`).all<{name:string}>();
 const valid=new Set(schema.results.map(c=>c.name));
 for(const row of section.rows){
  const columns=Object.keys(row);if(!columns.length||columns.some(c=>!valid.has(c)))throw Error('Invalid export columns: '+table);
  statements.push(env.DB.prepare(`INSERT INTO ${table} (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...columns.map(c=>row[c])));total++;
 }
}
await env.DB.batch(statements);
const unlinked=await env.DB.prepare('SELECT p.id,p.name FROM people p LEFT JOIN accounts a ON a.person=p.id WHERE a.id IS NULL').all<{id:string;name:string}>();
const claims=[];
await mkdir(dataDir,{recursive:true});
for(const person of unlinked.results){
 const token=randomBytes(32).toString('hex');
 await env.DB.prepare('INSERT INTO legacy_claims (hash,person,expires) VALUES (?,?,?)').bind(createHash('sha256').update(token).digest('hex'),person.id,Date.now()+7*86400000).run();
 claims.push(`原昵称：${person.name}\n迁移码：${token}\n`);
}
if(claims.length)await writeFile(join(dataDir,'旧空间迁移码.txt'),'仅供空间所有者保存，不要发给其他人。\n注册时展开“恢复原有空间”，填写迁移码。有效期 7 天，每个码仅能使用一次。\n\n'+claims.join('\n'),{mode:0o600});
console.log(JSON.stringify({imported:total,unlinkedSpaces:claims.length,privateClaimFile:claims.length?'data/旧空间迁移码.txt':null}));
