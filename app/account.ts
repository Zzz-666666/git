import type {Database} from './storage';
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {passwordHash} from './password';

const cookieName='__Host-wandeng';
const ttl=30*24*60*60*1000;
const json=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const hash=async(value:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const tokenFrom=(req:Request)=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
const sessionCookie=(token:string,seconds=ttl/1000)=>`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
type Account={id:string;person:string;username:string;password:string;salt:string;recovery:string};
export async function currentAccount(req:Request,db:Database){
 const token=tokenFrom(req);if(!/^[a-f0-9]{64}$/.test(token))return null;
 return db.prepare('SELECT a.id,a.person,a.username FROM accounts a JOIN sessions s ON a.id=s.account WHERE s.hash=? AND s.expires>?').bind(await hash(token),Date.now()).first<Pick<Account,'id'|'person'|'username'>>();
}
export async function legacyPerson(_req:Request,_db:Database):Promise<{id:string}|null>{return null}
async function limit(db:Database,key:string,max:number){
 const now=Date.now(),until=now+15*60000;
 const row=await db.prepare('INSERT INTO auth_limits (key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_limits.until<? THEN 1 ELSE auth_limits.count+1 END,until=CASE WHEN auth_limits.until<? THEN excluded.until ELSE auth_limits.until END RETURNING count').bind(await hash(key),until,now,now).first<{count:number}>();
 return !!row&&row.count<=max;
}
async function session(db:Database,account:string){
 const token=randomBytes(32).toString('hex');
 await db.batch([db.prepare('DELETE FROM sessions WHERE expires<=?').bind(Date.now()),db.prepare('INSERT INTO sessions (hash,account,expires) VALUES (?,?,?)').bind(await hash(token),account,Date.now()+ttl),db.prepare('DELETE FROM auth_limits WHERE until<=?').bind(Date.now())]);
 return sessionCookie(token);
}
export async function accountRoute(req:Request,db:Database,action:string,readBody:()=>Promise<any>){
 if(req.method!=='POST')return json({error:'请使用登录表单'},405);
 if(action==='logout'){
  await db.prepare('DELETE FROM sessions WHERE hash=?').bind(await hash(tokenFrom(req))).run();
  return json({ok:true},200,sessionCookie('',0));
 }
 if(!['register','login','recover'].includes(action))return json({error:'没有找到这个入口'},404);
 const ip=req.headers.get('cf-connecting-ip')||'local';
 if(!await limit(db,'ip:'+ip,30))return json({error:'操作太频繁，请 15 分钟后再试'},429);
 const b=await readBody();
 const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';
 const password=typeof b.password==='string'?b.password:'';
 if(!/^[a-z0-9_]{3,32}$/.test(username)||(action==='register'&&username.length>24))return json({error:action==='register'?'账号需为 3–24 位英文字母、数字或下划线':'请输入 3–32 位英文字母、数字或下划线账号'},400);
 if(password.length<12||password.length>128)return json({error:'密码需为 12–128 个字符'},400);
 if(!await limit(db,'account:'+username,12))return json({error:'尝试次数太多，请 15 分钟后再试'},429);
 const found=await db.prepare('SELECT * FROM accounts WHERE username=?').bind(username).first<Account>();
 if(action==='login'){
  const derived=await passwordHash(password,found?.salt||'wandeng-unknown-account-salt');
  if(!found||!equal(derived,found.password))return json({error:'账号或密码不正确'},401);
  return json({ok:true,username:found.username},200,await session(db,found.id));
 }
 if(action==='recover'){
  const code=typeof b.recoveryCode==='string'?b.recoveryCode.replace(/[-\s]/g,'').toLowerCase():'';
  if(!found||!/^[a-f0-9]{64}$/.test(code)||!equal(await hash(code),found.recovery))return json({error:'账号或恢复码不正确'},401);
  const recoveryCode=randomBytes(32).toString('hex'),salt=randomBytes(16).toString('hex');
  const result=await db.batch([db.prepare('UPDATE accounts SET password=?,salt=?,recovery=? WHERE id=? AND recovery=?').bind(await passwordHash(password,salt),salt,await hash(recoveryCode),found.id,found.recovery),db.prepare('DELETE FROM sessions WHERE account=?').bind(found.id)]);
  if(!result[0].meta.changes)return json({error:'恢复码已使用，请使用最新恢复码'},409);
  return json({ok:true,username:found.username,recoveryCode},200,await session(db,found.id));
 }
 const existing=await currentAccount(req,db);
 if(existing)return json({error:'请先退出当前账号'},409);
 const claim=typeof b.transferCode==='string'?b.transferCode.replace(/[-\s]/g,'').toLowerCase():'';
 const legacy=claim&&/^[a-f0-9]{64}$/.test(claim)?await db.prepare('SELECT person AS id FROM legacy_claims WHERE hash=? AND expires>?').bind(await hash(claim),Date.now()).first<{id:string}>():null;
 if(claim&&!legacy)return json({error:'迁移码无效或已使用'},409);
 if(b.migrate===true)return json({error:'请使用旧空间迁移码'},409);
 const person=legacy?.id||crypto.randomUUID(),id=crypto.randomUUID(),salt=randomBytes(16).toString('hex'),recoveryCode=randomBytes(32).toString('hex');
 const derived=await passwordHash(password,salt),recoveryHash=await hash(recoveryCode);
 for(let attempt=0;attempt<8;attempt++){
  const finalName=attempt===0&&!found?username:username+randomInt(attempt<4?1000:100000,attempt<4?10000:1000000);
  const statements=[];
  if(!legacy)statements.push(db.prepare('INSERT INTO people (id,auth,name,bio,avatar,dm,created,space_name,effect) VALUES (?,?,?,?,?,1,?,?,?)').bind(person,'local:'+id,'旅人'+randomBytes(3).toString('hex'),'','moon',Date.now(),'我的空间','fireworks'));
  statements.push(db.prepare('INSERT INTO accounts (id,person,username,password,salt,recovery,created) VALUES (?,?,?,?,?,?,?)').bind(id,person,finalName,derived,salt,recoveryHash,Date.now()));
  if(legacy)statements.push(db.prepare('DELETE FROM legacy_claims WHERE person=?').bind(person));
  try{await db.batch(statements)}catch(error){
   if(legacy&&await db.prepare('SELECT id FROM accounts WHERE person=?').bind(person).first())return json({error:'原空间已绑定账号，请直接登录'},409);
   if(await db.prepare('SELECT id FROM accounts WHERE username=?').bind(finalName).first())continue;
   throw error;
  }
  return json({ok:true,username:finalName,usernameAdjusted:finalName!==username,recoveryCode},201,await session(db,id));
 }
 return json({error:'暂时无法分配账号，请重试'},503);
}
