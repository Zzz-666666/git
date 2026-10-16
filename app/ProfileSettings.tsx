'use client';
import {useEffect,useState} from 'react';
import {Shuffle,Upload,Loader2,LogOut} from 'lucide-react';
import Avatar from './Avatar';
import {avatarLabels,effectLabels,spaceMessage,type Person} from './preferences';
export default function ProfileSettings({me,username,onLogout,onSave,onEffect}:{me:Person|null;username:string;onLogout:()=>Promise<void>;onSave:(data:any)=>Promise<void>;onEffect:(effect:string)=>void}){
 const [name,setName]=useState(me?.name||''),[spaceName,setSpaceName]=useState(me?.spaceName||'我的空间'),[bio,setBio]=useState(spaceMessage(me?.bio));
 const [avatar,setAvatar]=useState(me?.avatar||'moon'),[effect,setEffect]=useState(me?.effect||'fireworks'),[dm,setDM]=useState(me?!!me.dm:true);
 const [file,setFile]=useState<Blob|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[processing,setProcessing]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!file)return;const u=URL.createObjectURL(file);setPreview(u);return()=>URL.revokeObjectURL(u)},[file]);
 const choose=(key:string)=>{setFile(null);setPreview('');setAvatar(key)};
 async function upload(original:File){
  setProcessing(true);setError('');let url='';
  try{
   if(!/^image\/(png|jpeg|webp|gif)$/.test(original.type)||original.size>10*1024*1024)throw Error('请选择 10 MB 以内的 PNG、JPG、WebP 或 GIF 图片');
   url=URL.createObjectURL(original);const img=new Image();img.src=url;await img.decode();
   if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>12000||img.naturalHeight>12000)throw Error('图片尺寸不支持，请换一张');
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法处理图片');
   const side=Math.min(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,512,512);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片处理失败')),'image/jpeg',.86));
   setFile(blob);
  }catch(e){setError((e as Error).message)}finally{if(url)URL.revokeObjectURL(url);setProcessing(false)}
 }
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const data={name,spaceName,bio,avatar,effect,dm};if(file){const form=new FormData();form.set('data',JSON.stringify(data));form.set('avatarFile',file,'avatar.jpg');await onSave(form)}else await onSave(data)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><h2>空间设置</h2><p className="field-hint">登录账号：{username} · 仅自己可见</p><form onSubmit={save}>
 <fieldset disabled={busy||processing} className="settings-fields"><label className="field-label" htmlFor="space-name">空间名称</label><input id="space-name" className="field" value={spaceName} onChange={e=>setSpaceName(e.target.value)} maxLength={30} required/>
 <label className="field-label" htmlFor="space-message">空间留言</label><textarea id="space-message" className="field" value={bio} onChange={e=>setBio(e.target.value)} rows={2} maxLength={160} placeholder="可留空"/>
 <label className="field-label" htmlFor="nickname">匿名昵称</label><input id="nickname" className="field" value={name} onChange={e=>setName(e.target.value)} maxLength={16} required/>
 <div className="field-label">头像</div><div className="avatar-actions"><Avatar type={file?preview:avatar}/><label className="subtle-button upload-button"><Upload size={15}/>{processing?'正在处理…':'上传图片'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="上传头像" onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.target.value=''}}/></label><button type="button" className="subtle-button" onClick={()=>{const keys=Object.keys(avatarLabels).filter(a=>a!==avatar);choose(keys[Math.floor(Math.random()*keys.length)])}}><Shuffle size={15}/>随机</button></div>
 <div className="avatar-picker expanded">{Object.entries(avatarLabels).map(([key,label])=><button type="button" key={key} className={!file&&avatar===key?'chosen':''} onClick={()=>choose(key)} aria-label={label} aria-pressed={!file&&avatar===key} title={label}><Avatar type={key}/></button>)}</div>
 <div className="field-label">点击效果</div><div className="effect-picker">{Object.entries(effectLabels).map(([key,label])=><button type="button" key={key} className={effect===key?'chosen':''} aria-pressed={effect===key} onClick={()=>{setEffect(key);onEffect(key)}}><span aria-hidden="true">{({fireworks:'✺',stars:'✦',hearts:'♥',petals:'❀',bubbles:'◌',off:'—'} as Record<string,string>)[key]}</span>{label}</button>)}</div><p className="field-hint">选中后点击空白处预览，保存后生效。</p>
 <label className="checkbox"><input type="checkbox" checked={dm} onChange={e=>setDM(e.target.checked)}/>接收其他用户的私信</label></fieldset>
 {error?<p className="form-error" role="alert">{error}</p>:null}<button className="write-button wide" disabled={busy||processing||!name.trim()||!spaceName.trim()}>{busy?<Loader2 size={16} className="spin"/>:null}保存</button>
 </form>{me?<button className="logout" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onLogout()}catch{setError('退出失败，请重试');setBusy(false)}}}><LogOut size={14}/>退出登录</button>:null}</>;
}
