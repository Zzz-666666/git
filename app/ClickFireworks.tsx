'use client';
import {useEffect,useRef} from 'react';

export default function ClickFireworks({variant='fireworks'}:{variant?:string}){
 const layer=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const colors=['#edc78f','#efb6cd','#a9d9c5','#c0c3ef'];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const burst=(event:MouseEvent)=>{
   if(variant==='off')return;
   const host=layer.current;if(!host)return;
   const target=event.target instanceof Element?event.target:null;
   const box=target?.getBoundingClientRect();
   const x=event.detail===0&&box?box.left+box.width/2:event.clientX;
   const y=event.detail===0&&box?box.top+box.height/2:event.clientY;
   // ponytail: cap live particles so rapid clicks stay light on mobile.
   while(host.childElementCount>66)host.firstElementChild?.remove();
   for(let i=0;i<(reduced.matches?1:variant==='bubbles'?7:12);i++){
    const dot=document.createElement('i');
    dot.className=reduced.matches?'spark soft-spark':`spark effect-${variant} ${variant==='stars'||(variant==='fireworks'&&i%4===0)?'star-spark':''}`;
    dot.style.left=x+'px';dot.style.top=y+'px';dot.style.background=colors[i%colors.length];
    dot.style.color=colors[i%colors.length];
    if(variant==='hearts'&&!reduced.matches)dot.textContent='♥';
    host.appendChild(dot);
    const angle=i*Math.PI/6,reach=23+(i%3)*12;
    const dx=Math.cos(angle)*reach;
    const dy=variant==='hearts'||variant==='bubbles'?-30-reach:variant==='petals'?reach:Math.sin(angle)*reach+12;
    const motion=dot.animate(reduced.matches?[
     {opacity:.65,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}
    ]:[
     {opacity:0,transform:'translate(-50%,-50%) scale(.3)'},
     {opacity:1,offset:.12},
     {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${variant==='bubbles'?1.2:.15}) rotate(${variant==='petals'?140:variant==='hearts'?0:100}deg)`}
    ],{duration:reduced.matches?180:variant==='bubbles'?850:700,easing:'cubic-bezier(.15,.6,.3,1)'});
    motion.onfinish=()=>dot.remove();motion.oncancel=()=>dot.remove();
   }
  };
  document.addEventListener('click',burst,true);
  return()=>{document.removeEventListener('click',burst,true);layer.current?.replaceChildren()};
 },[variant]);
 return <div className="firework-layer" ref={layer} aria-hidden="true"/>;
}
