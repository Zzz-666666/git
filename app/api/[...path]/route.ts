import {env} from '../../storage';
import {avatarLabels,effectLabels} from '../../preferences';
import {accountRoute,currentAccount,legacyPerson} from '../../account';
export const dynamic = 'force-dynamic';
type Person = {id:string;name:string;bio:string;avatar:string;dm:number;spaceName:string;effect:string};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const publicPerson='id,name,bio,avatar,dm,created,space_name AS spaceName,effect';
const moods=['平静','开心','低落','焦虑','想念','说不清'];
// ponytail: newest 100 posts / 200 messages per request; add cursor pagination when histories grow.
async function readLimited(req:Request,max:number){
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const parts:Uint8Array[]=[];let size=0;
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();throw Error('内容太长了，请缩短文字或语音')}parts.push(r.value)}
 const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out;
}
async function handler(req:Request){
 try {
  const db=env.DB!; if(!db) return reply({error:'服务暂时不可用，请稍后再试'},503);
  const url=new URL(req.url); const path=url.pathname.slice(5).split('/');
  if(req.method!=='GET'){
   if(req.headers.get('origin')!==url.origin||req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'请从晚灯页面提交'},403);
  }
  const input=req.method==='GET'?new Uint8Array():await readLimited(req,path[0]==='posts'?6*1024*1024:path[0]==='profile'?1500000:16000);
  const body=async()=>JSON.parse(new TextDecoder().decode(input));
  if(path[0]==='auth'){
   try{return await accountRoute(req,db,path[1]||'',body)}
   catch(error){console.error('Account service failed',error instanceof Error?error.message:'unknown');return reply({error:'账号服务暂时不可用，请稍后重试'},503)}
  }
  const account=await currentAccount(req,db);
  const me=account?await db.prepare(`SELECT ${publicPerson} FROM people WHERE id=?`).bind(account.person).first<Person>():null;
  if(path[0]==='me'&&req.method==='GET')return reply({me,signedIn:!!me,username:account?.username,legacyAvailable:!me&&!!await legacyPerson(req,db)});
  if(!me)return reply({error:'请先登录晚灯',signin:true},401);
  const checkText=(s:unknown,max:number)=>{if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw Error(`请输入 1–${max} 字`);return s.trim()};
  const accessible=async(id:string)=>{const p=await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first<any>();return p&&(p.visibility==='public'||p.author===me?.id)?p:null};
  if(path[0]==='profile'&&req.method==='POST'){
   let b:any,file:File|null=null;
   if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
    const form=await new Response(input,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();
    b=JSON.parse(String(form.get('data')||'{}'));const candidate=form.get('avatarFile');if(candidate instanceof File)file=candidate;
   }else b=await body();
   const name=checkText(b.name,16),bio=typeof b.bio==='string'?b.bio.trim():me?.bio||'';
   if(bio.length>160)throw Error('请输入不超过 160 字的空间留言');
   const spaceName=b.spaceName===undefined?me?.spaceName||'我的空间':checkText(b.spaceName,30);
   const effect=b.effect===undefined?me?.effect||'fireworks':String(b.effect);
   if(!Object.hasOwn(effectLabels,effect))throw Error('请选择有效的点击效果');
   let avatar=b.avatar===undefined?me?.avatar||'moon':String(b.avatar);
   if(!Object.hasOwn(avatarLabels,avatar)&&avatar!==me?.avatar)throw Error('请选择有效的头像');
   const id=me?.id||crypto.randomUUID();let key:string|null=null;
   if(file){
    if(file.size===0||file.size>1048576)throw Error('请上传不超过 1 MB 的头像');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const png=bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    const jpg=bytes.length>=24&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=bytes.length>=24&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!png&&!jpg&&!webp)throw Error('请上传 PNG、JPG 或 WebP 图片');
    key=`avatars/${id}/${crypto.randomUUID()}`;avatar='upload:'+key.slice(8);
    await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:png?'image/png':jpg?'image/jpeg':'image/webp'}});
   }
   try{
    if(me)await db.prepare('UPDATE people SET name=?,bio=?,avatar=?,dm=?,space_name=?,effect=? WHERE id=?').bind(name,bio,avatar,b.dm===undefined?me.dm:b.dm===false?0:1,spaceName,effect,id).run();
   }catch(e){if(key)await env.BUCKET!.delete(key);throw e}
   if(me?.avatar.startsWith('upload:')&&me.avatar!==avatar)await env.BUCKET!.delete('avatars/'+me.avatar.slice(7));
   return reply({ok:true});
  }
  if(path[0]==='avatar'&&req.method==='GET'){
   const token=path.slice(1).join('/');if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(token))return reply({error:'头像不存在'},404);
   if(!await db.prepare('SELECT id FROM people WHERE avatar=?').bind('upload:'+token).first())return reply({error:'头像不存在'},404);
   const file=await env.BUCKET!.get('avatars/'+token);if(!file)return reply({error:'头像不存在'},404);
   return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'image/png','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'}});
  }
  if(path[0]==='social'){
   if(!me)return reply({error:'请先创建匿名身份'},401);
   if(req.method==='GET'){
    const columns='u.id,u.name,u.bio,u.avatar,u.dm,u.space_name AS spaceName';
    const [friends,following,incoming,outgoing,noteRows]=await Promise.all([
     db.prepare(`SELECT ${columns} FROM friendships f JOIN people u ON u.id=CASE WHEN f.first=? THEN f.second ELSE f.first END WHERE (f.first=? OR f.second=?) AND f.state='accepted' ORDER BY f.created DESC LIMIT 500`).bind(me.id,me.id,me.id).all(),
     db.prepare(`SELECT ${columns} FROM follows f JOIN people u ON u.id=f.target WHERE f.owner=? ORDER BY f.created DESC LIMIT 500`).bind(me.id).all(),
     db.prepare(`SELECT ${columns} FROM friendships f JOIN people u ON u.id=f.requester WHERE (f.first=? OR f.second=?) AND f.requester!=? AND f.state='pending' ORDER BY f.created DESC LIMIT 500`).bind(me.id,me.id,me.id).all(),
     db.prepare(`SELECT ${columns} FROM friendships f JOIN people u ON u.id=CASE WHEN f.first=? THEN f.second ELSE f.first END WHERE f.requester=? AND f.state='pending' ORDER BY f.created DESC LIMIT 500`).bind(me.id,me.id).all(),
     db.prepare('SELECT target,label FROM notes WHERE owner=? LIMIT 500').bind(me.id).all<{target:string;label:string}>()
    ]);
    return reply({friends:friends.results,following:following.results,incoming:incoming.results,outgoing:outgoing.results,notes:Object.fromEntries(noteRows.results.map(n=>[n.target,n.label]))});
   }
   if(req.method==='POST'){
    const b=await body();if(typeof b.target!=='string'||b.target===me.id)throw Error('请选择其他用户');
    const other=await db.prepare('SELECT id FROM people WHERE id=?').bind(b.target).first();if(!other)return reply({error:'用户不存在'},404);
    const pair=[me.id,b.target].sort();
    if(b.action==='follow')await db.prepare('INSERT OR IGNORE INTO follows (owner,target,created) VALUES (?,?,?)').bind(me.id,b.target,Date.now()).run();
    else if(b.action==='unfollow')await db.prepare('DELETE FROM follows WHERE owner=? AND target=?').bind(me.id,b.target).run();
    else if(b.action==='note'){
     if(typeof b.note!=='string'||b.note.length>30)throw Error('请输入不超过 30 字的备注');
     if(b.note.trim())await db.prepare('INSERT INTO notes (owner,target,label) VALUES (?,?,?) ON CONFLICT(owner,target) DO UPDATE SET label=excluded.label').bind(me.id,b.target,b.note.trim()).run();
     else await db.prepare('DELETE FROM notes WHERE owner=? AND target=?').bind(me.id,b.target).run();
    }else{
     const f=await db.prepare('SELECT requester,state FROM friendships WHERE first=? AND second=?').bind(...pair).first<{requester:string;state:string}>();
     if(b.action==='request'){
      if(f?.state==='pending'&&f.requester!==me.id)return reply({error:'对方已向你申请，请选择接受或拒绝'},409);
      if(!f)await db.prepare("INSERT OR IGNORE INTO friendships (first,second,requester,state,created) VALUES (?,?,?,'pending',?)").bind(...pair,me.id,Date.now()).run();
     }else if(b.action==='accept'||b.action==='decline'){
      if(!f||f.state!=='pending'||f.requester===me.id)return reply({error:'没有可以处理的好友申请'},403);
      if(b.action==='accept')await db.prepare("UPDATE friendships SET state='accepted' WHERE first=? AND second=? AND state='pending' AND requester!=?").bind(...pair,me.id).run();
      else await db.prepare("DELETE FROM friendships WHERE first=? AND second=? AND state='pending' AND requester!=?").bind(...pair,me.id).run();
     }else if(b.action==='cancel')await db.prepare("DELETE FROM friendships WHERE first=? AND second=? AND state='pending' AND requester=?").bind(...pair,me.id).run();
     else if(b.action==='remove')await db.prepare("DELETE FROM friendships WHERE first=? AND second=? AND state='accepted'").bind(...pair).run();
     else throw Error('请选择有效的操作');
    }
    return reply({ok:true});
   }
  }
  if(path[0]==='people'&&req.method==='GET'){
   const person=await db.prepare(`SELECT ${publicPerson} FROM people WHERE id=?`).bind(path[1]||'').first();return person?reply(person):reply({error:'这个空间还没有点亮'},404);
  }
  if(path[0]==='posts'&&path.length===1&&req.method==='GET'){
   const author=url.searchParams.get('author');
   const where=author?'p.author=? AND (p.visibility=\'public\' OR p.author=?)':"p.visibility='public'";
   const query=db.prepare(`SELECT p.id,p.author,p.text,p.mood,p.visibility,p.duration,p.created,(p.audio IS NOT NULL) as hasAudio,u.name,u.avatar,
    (SELECT COUNT(*) FROM hugs h WHERE h.post=p.id) as hugs,(SELECT COUNT(*) FROM comments c WHERE c.post=p.id) as comments,
    (SELECT COUNT(*) FROM hugs h WHERE h.post=p.id AND h.author=?) as hugged
    FROM posts p JOIN people u ON p.author=u.id WHERE ${where} ORDER BY p.created DESC LIMIT 100`);
   const r=await (author?query.bind(me?.id||'',author,me?.id||''):query.bind(me?.id||'')).all();return reply(r.results);
  }
  if(path[0]==='posts'&&path.length===1&&req.method==='POST'){
   if(Number(req.headers.get('content-length')||0)>6*1024*1024)return reply({error:'语音文件不能超过 5 MB'},413);
   const f=await new Response(input,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();const text=String(f.get('text')||'').trim();const audio=f.get('audio');
   if(text.length>2000||(!text&&!(audio instanceof File)))throw Error('请写一点心事，或录一段声音');
   const mood=String(f.get('mood')||'平静'),visibility=String(f.get('visibility')||'public');
   if(!moods.includes(mood)||!['public','private'].includes(visibility))throw Error('请选择有效的心情和可见范围');
   const id=crypto.randomUUID();let key=null,mime=null,duration=null;
   if(audio instanceof File){
    if(audio.size===0||audio.size>5*1024*1024||!/^audio\/(webm|ogg|mp4|mpeg|wav)(;|$)/.test(audio.type))throw Error('请上传有效的语音，最大 5 MB');
    duration=Number(f.get('duration'));if(!Number.isFinite(duration)||duration<1||duration>120)throw Error('语音时长需要在 1–120 秒之间');
    key=`voice/${me!.id}/${id}`;mime=audio.type;await env.BUCKET!.put(key,await audio.arrayBuffer(),{httpMetadata:{contentType:mime}});
   }
   try{await db.prepare('INSERT INTO posts (id,author,text,mood,visibility,audio,mime,duration,created) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,me!.id,text,mood,visibility,key,mime,duration,Date.now()).run()}
   catch(e){if(key)await env.BUCKET!.delete(key);throw e}
   return reply({id},201);
  }
  if(path[0]==='posts'&&req.method==='DELETE'){
   const p=await accessible(path[1]);if(!p||p.author!==me!.id)return reply({error:'不能删除这条心事'},403);
   await db.batch([db.prepare('DELETE FROM hugs WHERE post=?').bind(p.id),db.prepare('DELETE FROM comments WHERE post=?').bind(p.id),db.prepare('DELETE FROM posts WHERE id=? AND author=?').bind(p.id,me!.id)]);
   if(p.audio)await env.BUCKET!.delete(p.audio);return reply({ok:true});
  }
  if(path[0]==='audio'&&req.method==='GET'){
   const p=await accessible(path[1]);if(!p?.audio)return reply({error:'这段声音不可访问'},404);
   const obj=await env.BUCKET!.get(p.audio);if(!obj)return reply({error:'声音暂时不可用'},404);
   return new Response(obj.body,{headers:{'Content-Type':p.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(path[0]==='comments'){
   const p=await accessible(path[1]);if(!p)return reply({error:'这条心事不可访问'},404);
   if(req.method==='GET'){const r=await db.prepare('SELECT c.id,c.text,c.created,u.name,u.avatar,u.id as author FROM comments c JOIN people u ON c.author=u.id WHERE c.post=? ORDER BY c.created ASC LIMIT 100').bind(p.id).all();return reply(r.results)}
   if(req.method==='POST'){const b=await body();await db.prepare('INSERT INTO comments VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),p.id,me!.id,checkText(b.text,500),Date.now()).run();return reply({ok:true},201)}
  }
  if(path[0]==='hugs'&&req.method==='POST'){
   const p=await accessible(path[1]);if(!p)return reply({error:'这条心事不可访问'},404);
   const has=await db.prepare('SELECT 1 FROM hugs WHERE post=? AND author=?').bind(p.id,me!.id).first();
   await db.prepare(has?'DELETE FROM hugs WHERE post=? AND author=?':'INSERT OR IGNORE INTO hugs (post,author) VALUES (?,?)').bind(p.id,me!.id).run();return reply({ok:true});
  }
  if(path[0]==='messages'){
   if(!me)return reply({error:'请先创建匿名身份'},401);
   if(req.method==='GET'){
    const other=url.searchParams.get('with');
    const r=await (other?db.prepare(`SELECT * FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC LIMIT 200`).bind(me.id,other,other,me.id):
      db.prepare(`SELECT m.id,m.sender,m.recipient,m.text,m.created,u.id as peer,u.name,u.avatar FROM messages m JOIN people u ON u.id=CASE WHEN m.sender=? THEN m.recipient ELSE m.sender END WHERE m.sender=? OR m.recipient=? ORDER BY m.created DESC LIMIT 200`).bind(me.id,me.id,me.id)).all();return reply(other?r.results.reverse():r.results);
   }
   if(req.method==='POST'){
    const b=await body();if(typeof b.recipient!=='string'||b.recipient===me.id)throw Error('请选择另一位朋友');
    const peer=await db.prepare('SELECT id,dm FROM people WHERE id=?').bind(b.recipient).first<Person>();if(!peer||!peer.dm)return reply({error:'对方暂时关闭了私聊'},403);
    await db.prepare('INSERT INTO messages VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),me.id,peer.id,checkText(b.text,1000),Date.now()).run();return reply({ok:true},201);
   }
  }
  return reply({error:'没有找到这个入口'},404);
 }catch(error){console.error('API request failed',error instanceof Error?error.message:'unknown');return reply({error:error instanceof Error&&/^(请输入|请写|请选择|请上传|语音|内容)/.test(error.message)?error.message:'没有保存成功，请稍后重试'},400)}
}
export const GET=handler;export const POST=handler;export const DELETE=handler;
