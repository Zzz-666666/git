export async function startVoiceRecording(onDone:(blob:Blob,seconds:number)=>void,onError:(error:Error)=>void,onTick:(seconds:number)=>void){
 if(!window.isSecureContext)throw Error('录音需要安全连接，请通过 HTTPS 打开晚灯');
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('当前浏览器不支持录音，可以选择语音文件');
 const stream=await navigator.mediaDevices.getUserMedia({audio:true});
 let recorder:MediaRecorder;
 try{const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)}catch(e){stream.getTracks().forEach(t=>t.stop());throw e}
 const chunks:Blob[]=[];const started=Date.now();let failed=false,interval:ReturnType<typeof setInterval>|undefined;
 const cleanup=()=>{clearInterval(interval);stream.getTracks().forEach(t=>t.stop())};
 const stop=()=>{if(recorder.state==='recording')recorder.stop()};
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 recorder.onerror=()=>{failed=true;cleanup();onError(Error('录音中断，请重试或选择语音文件'))};
 recorder.onstop=()=>{
  cleanup();if(failed)return;
  const blob=new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type||'audio/webm'});
  if(!blob.size){onError(Error('没有录到声音，请检查麦克风权限后重试'));return}
  if(blob.size>5*1024*1024){onError(Error('语音超过 5 MB，请缩短后重试'));return}
  onDone(blob,Math.min(120,Math.max(1,Math.round((Date.now()-started)/1000))));
 };
 try{recorder.start();interval=setInterval(()=>{const n=Math.floor((Date.now()-started)/1000);onTick(n);if(n>=120)stop()},300)}catch(e){cleanup();throw e}
 return {stop,cancel:()=>{failed=true;stop();cleanup()}};
}

export async function readVoiceFile(file:File):Promise<{blob:Blob;seconds:number}>{
 if(!file.size||file.size>5*1024*1024)throw Error('请选择不超过 5 MB 的语音');
 const type=file.type==='audio/x-m4a'?'audio/mp4':file.type||(/\.m4a$/i.test(file.name)?'audio/mp4':'');
 if(!/^audio\/(webm|ogg|mp4|mpeg|wav)(;|$)/.test(type))throw Error('请选择 M4A、MP3、WAV、WebM 或 Ogg 语音');
 const blob=new Blob([file],{type}),url=URL.createObjectURL(blob),audio=new Audio();
 try{
  const seconds=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('读取语音超时，请重试')),10000);audio.onloadedmetadata=()=>{clearTimeout(timer);resolve(audio.duration)};audio.onerror=()=>{clearTimeout(timer);reject(Error('无法读取这段语音，请换一个文件'))};audio.src=url});
  if(!Number.isFinite(seconds)||seconds<=0||seconds>120.5)throw Error('请选择 120 秒以内的语音');
  return {blob,seconds:Math.min(120,Math.max(1,Math.round(seconds)))};
 }finally{audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url)}
}
