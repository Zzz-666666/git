import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:8790';
if(new URL(origin).hostname!=='127.0.0.1')throw Error('Only run identity simulation against a local built Worker.');
const run=crypto.randomUUID().replaceAll('-','').slice(0,14);const created=[];const cookies={};const password='local-check-password-42';const accounts={};
async function request(user,path,method='GET',data,extra={}){
 console.log('CHECK',method,path);
 const headers={Connection:"close",'cf-connecting-ip':'test-'+run,...extra};if(user&&cookies[user])headers.Cookie=cookies[user];
 if(method!=='GET')headers.Origin=origin;
 if(data&&!(data instanceof FormData))headers['Content-Type']='application/json';
 const r=await fetch(origin+'/api/'+path,{method,headers,signal:AbortSignal.timeout(20000),body:data?(data instanceof FormData?data:JSON.stringify(data)):undefined});
 if(user&&r.headers.has('set-cookie')){const value=r.headers.get('set-cookie');cookies[user]=value.split(';')[0];assert.ok(value.includes('HttpOnly')&&value.includes('Secure')&&value.includes('SameSite=Lax')&&value.includes('Path=/'));}
 const body=r.headers.get('content-type')?.includes('application/json')?await r.json():r.ok?await r.arrayBuffer():await r.text();return {status:r.status,body};
}
const json=async(...args)=>{const r=await request(...args);assert.ok(r.status<300,JSON.stringify(r));return r.body};
async function post(user,visibility,text,audio){const f=new FormData();f.set('text',text);f.set('mood','平静');f.set('visibility',visibility);if(audio){f.set('audio',new Blob([audio],{type:'audio/wav'}),'voice.wav');f.set('duration','1')}const r=await json(user,'posts','POST',f);created.push([user,r.id]);return r.id}
function wav(){const b=new ArrayBuffer(16044),v=new DataView(b),u=new Uint8Array(b);for(const [at,s]of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<s.length;i++)u[at+i]=s.charCodeAt(i);v.setUint32(4,16036,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,16000,true);return b}
try{
 assert.equal((await request(null,'profile','POST',{name:'拒绝匿名写入'})).status,401);
 assert.equal((await request(null,'posts')).status,401);
 const spoof=await fetch(origin+'/api/posts',{headers:{'oai-authenticated-user-id':run+'-a'},signal:AbortSignal.timeout(20000)});assert.equal(spoof.status,401);
 for(const u of ['a','b','c']){const username=run+'_'+u;accounts[u]=username;const registered=await json(u,'auth/register','POST',{username,password});assert.match(registered.recoveryCode,/^[a-f0-9]{64}$/);await json(u,'profile','POST',{name:'测试旅人 '+u,bio:'本地验证',avatar:'moon'});}
 const duplicatePassword='duplicate-password-check-42';
 const duplicate=await json('duplicate','auth/register','POST',{username:accounts.a.toUpperCase(),password:duplicatePassword});
 assert.equal(duplicate.usernameAdjusted,true);assert.match(duplicate.username,new RegExp('^'+accounts.a+'[0-9]{4,6}$'));
 assert.equal((await json('duplicate','me')).username,duplicate.username);
 await json('duplicate','auth/logout','POST',{});await json('duplicate','auth/login','POST',{username:duplicate.username,password:duplicatePassword});
 assert.equal((await request('duplicate','auth/login','POST',{username:accounts.a,password:duplicatePassword})).status,401);
 const edgeHeaders={'cf-connecting-ip':'edge-'+run},longBase=(run+'abcdefghijklmnopqrstuvwx').slice(0,24);
 await json('long1','auth/register','POST',{username:longBase,password},edgeHeaders);
 const long=await json('long2','auth/register','POST',{username:longBase,password},edgeHeaders);
 assert.ok(long.username.startsWith(longBase));assert.ok(long.username.length>24&&long.username.length<=32);
 await json('long2','auth/logout','POST',{});await json('long2','auth/login','POST',{username:long.username,password},edgeHeaders);
 const raceBase=run+'_race';
 const raced=await Promise.all(['race1','race2','race3'].map(u=>json(u,'auth/register','POST',{username:raceBase,password},edgeHeaders)));
 assert.equal(new Set(raced.map(r=>r.username)).size,3);assert.equal(raced.filter(r=>r.username===raceBase).length,1);
 for(let i=0;i<3;i++){await json('race'+(i+1),'auth/logout','POST',{});await json('race'+(i+1),'auth/login','POST',{username:raced[i].username,password},edgeHeaders);}

 assert.equal((await request(null,'auth/register','POST',{username:run+'_bad',password:'short'})).status,400);
 assert.equal((await request(null,'auth/register','POST',{username:run+'_old',password,migrate:true})).status,409);
 const oldCookie=cookies.c;await json('c','auth/logout','POST',{});assert.equal((await json('c','me')).signedIn,false);
 const stale=await fetch(origin+'/api/posts',{headers:{Cookie:oldCookie}});assert.equal(stale.status,401);
 assert.equal((await request('c','auth/login','POST',{username:accounts.c,password:'wrong-password-42'})).status,401);
 await json('c','auth/login','POST',{username:accounts.c.toUpperCase(),password});
 const oldC=cookies.c;
 assert.equal((await request('c','auth/recover','POST',{username:accounts.c,password,recoveryCode:'0'.repeat(64)})).status,401);
 const d=await json('d','auth/register','POST',{username:run+'_d',password});const oldD=cookies.d;
 const reset=await json('d','auth/recover','POST',{username:run+'_d',password:password+'-new',recoveryCode:d.recoveryCode});assert.notEqual(reset.recoveryCode,d.recoveryCode);
 const revoked=await fetch(origin+'/api/posts',{headers:{Cookie:oldD}});assert.equal(revoked.status,401);
 assert.equal((await request('d','auth/recover','POST',{username:run+'_d',password,recoveryCode:d.recoveryCode})).status,401);
 assert.equal((await request('d','auth/login','POST',{username:run+'_d',password})).status,401);
 await json('d','auth/login','POST',{username:run+'_d',password:password+'-new'});
 assert.equal((await fetch(origin+'/api/posts',{headers:{Cookie:oldC}})).status,200);
 const a=(await json('a','me')).me,b=(await json('b','me')).me;
 assert.ok(a.id!==b.id);assert.equal('auth' in a,false);
 await json('a','profile','POST',{name:a.name,spaceName:'测试空间 A',bio:'我自己写的留言',avatar:'cat',effect:'bubbles'});
 const personalized=(await json('a','me')).me;assert.equal(personalized.spaceName,'测试空间 A');assert.equal(personalized.bio,'我自己写的留言');assert.equal(personalized.avatar,'cat');assert.equal(personalized.effect,'bubbles');
 assert.equal((await json('b','people/'+a.id)).spaceName,'测试空间 A');
 assert.equal((await request('a','profile','POST',{name:a.name,effect:'not-a-style'})).status,400);
 const upload=new FormData();upload.set('data',JSON.stringify({name:a.name,spaceName:'测试空间 A',bio:'我自己写的留言',effect:'stars'}));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jco0AAAAASUVORK5CYII=','base64');
 upload.set('avatarFile',new Blob([png],{type:'image/png'}),'avatar.png');await json('a','profile','POST',upload);
 const uploaded=(await json('a','me')).me.avatar;assert.ok(uploaded.startsWith('upload:'));
 assert.equal((await request('b','avatar/'+uploaded.slice(7))).status,200);
 assert.equal((await request('b','profile','POST',{name:b.name,avatar:uploaded})).status,400);
 const invalid=new FormData();invalid.set('data',JSON.stringify({name:b.name}));invalid.set('avatarFile',new Blob(['<svg onload="alert(1)"></svg>'],{type:'image/svg+xml'}),'unsafe.svg');assert.equal((await request('b','profile','POST',invalid)).status,400);
 await json('a','profile','POST',{name:a.name,avatar:'rabbit'});assert.equal((await request('b','avatar/'+uploaded.slice(7))).status,404);
 assert.equal((await request(null,'social')).status,401);
 await json('a','social','POST',{target:b.id,action:'follow'});await json('a','social','POST',{target:b.id,action:'follow'});
 assert.equal((await json('a','social')).following.filter(p=>p.id===b.id).length,1);assert.equal((await json('c','social')).following.length,0);
 await json('a','social','POST',{target:b.id,action:'note',note:'我给 B 的私人备注'});
 assert.equal((await json('a','social')).notes[b.id],'我给 B 的私人备注');assert.deepEqual((await json('b','social')).notes,{});assert.deepEqual((await json('c','social')).notes,{});
 assert.equal('note' in await json('c','people/'+b.id),false);
 await json('a','social','POST',{target:b.id,action:'request'});assert.ok((await json('b','social')).incoming.some(p=>p.id===a.id));
 assert.equal((await request('a','social','POST',{target:b.id,action:'accept'})).status,403);
 assert.equal((await request('c','social','POST',{target:a.id,action:'accept'})).status,403);
 assert.equal((await request('a','social','POST',{target:a.id,action:'request'})).status,400);
 await json('b','social','POST',{target:a.id,action:'accept'});assert.ok((await json('a','social')).friends.some(p=>p.id===b.id));assert.ok((await json('b','social')).friends.some(p=>p.id===a.id));
 await json('c','social','POST',{target:b.id,action:'remove'});assert.ok((await json('a','social')).friends.some(p=>p.id===b.id));
 const pub=await post('a','public','公开心事'),priv=await post('a','private','私人心事',wav());
 const hall=await json('b','posts');assert.ok(hall.some(x=>x.id===pub));assert.ok(!hall.some(x=>x.id===priv));
 const profile=await json('b','posts?author='+a.id);assert.ok(!profile.some(x=>x.id===priv));
 assert.ok((await json('a','posts?author='+a.id)).some(x=>x.id===priv));
 assert.equal((await request('b','comments/'+priv)).status,404);
 assert.equal((await request('b','audio/'+priv)).status,404);
 const voice=await request('a','audio/'+priv);assert.equal(voice.status,200);assert.equal(voice.body.byteLength,16044);
 assert.equal((await request('b','posts/'+pub,'DELETE')).status,403);
 await json('b','hugs/'+pub,'POST');assert.equal((await json('b','posts')).find(x=>x.id===pub).hugs,1);
 await json('b','hugs/'+pub,'POST');assert.equal((await json('b','posts')).find(x=>x.id===pub).hugs,0);
 await json('b','comments/'+pub,'POST',{text:'我在听'});assert.equal((await json('a','comments/'+pub))[0].text,'我在听');
 await json('a','messages','POST',{recipient:b.id,text:'仅彼此可见的信'});
 assert.equal((await json('b','messages?with='+a.id)).length,1);
 assert.equal((await json('c','messages?with='+a.id)).length,0);
 assert.equal((await json('c','messages?with='+b.id)).length,0);
 await json('b','profile','POST',{name:b.name,bio:'关闭私聊',avatar:'moon',dm:false});
 assert.equal((await request('a','messages','POST',{recipient:b.id,text:'应被拒绝'})).status,403);
 const bad=await fetch(origin+'/api/messages',{method:'POST',headers:{Origin:'https://evil.test',Cookie:cookies.a,'Content-Type':'application/json'},body:JSON.stringify({recipient:b.id,text:'跨站提交'})});assert.equal(bad.status,403);
 await json('b','social','POST',{target:a.id,action:'remove'});assert.ok(!(await json('a','social')).friends.some(p=>p.id===b.id));assert.equal((await json('b','messages?with='+a.id)).length,1);
 await json('a','social','POST',{target:b.id,action:'request'});await json('b','social','POST',{target:a.id,action:'decline'});assert.ok(!(await json('a','social')).outgoing.some(p=>p.id===b.id));
 await json('a','social','POST',{target:b.id,action:'request'});await json('a','social','POST',{target:b.id,action:'cancel'});assert.ok(!(await json('b','social')).incoming.some(p=>p.id===a.id));
 await json('a','social','POST',{target:b.id,action:'unfollow'});await json('a','social','POST',{target:b.id,action:'note',note:''});assert.ok(!(await json('a','social')).following.some(p=>p.id===b.id));assert.equal((await json('a','social')).notes[b.id],undefined);
 const rateHeaders={'cf-connecting-ip':'limit-'+run};
 for(let i=0;i<12;i++)assert.equal((await request(null,'auth/recover','POST',{username:run+'_limit',password,recoveryCode:'0'.repeat(64)},rateHeaders)).status,401);
 assert.equal((await request(null,'auth/recover','POST',{username:run+'_limit',password,recoveryCode:'0'.repeat(64)},rateHeaders)).status,429);
 const ipHeaders={'cf-connecting-ip':'ip-limit-'+run};
 for(let i=0;i<30;i++)assert.equal((await request(null,'auth/login','POST',{username:'!',password},ipHeaders)).status,400);
 assert.equal((await request(null,'auth/login','POST',{username:'!',password},ipHeaders)).status,429);
 console.log('PASS: duplicate auto-suffix, long-name suffix login, concurrent duplicate registration, unchanged original account, portable compatible password hashing, account/IP limits and secure cookie attributes,  standalone registration/login, password hashing, logout/revocation, recovery rotation, anonymous API denial, custom space/message/effects, avatar upload/replacement and validation, friendship request/accept/decline/cancel/remove, follow/unfollow, private notes, original post/voice/chat privacy.');
}finally{for(const [u,id]of created)await request(u,'posts/'+id,'DELETE')}
