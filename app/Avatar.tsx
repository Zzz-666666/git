import {Moon,Star,Leaf,Cloud,Flower2,Cat,Dog,Rabbit,Bird,Fish,Sun,Coffee,Music,Heart,Orbit,Cherry} from 'lucide-react';
const icons:Record<string,typeof Moon>={moon:Moon,star:Star,leaf:Leaf,cloud:Cloud,flower:Flower2,cat:Cat,dog:Dog,rabbit:Rabbit,bird:Bird,fish:Fish,sun:Sun,coffee:Coffee,music:Music,heart:Heart,planet:Orbit,cherry:Cherry};
export default function Avatar({type='moon',small=false}:{type?:string;small?:boolean}){
 const photo=type.startsWith('upload:')?'/api/avatar/'+type.slice(7):type.startsWith('blob:')?type:null;
 const Icon=icons[type]||Moon;
 return <span className={`avatar ${icons[type]?type:'photo'} ${small?'small':''}`}>{photo?<img src={photo} alt="" loading="lazy"/>:<Icon size={small?17:21} strokeWidth={1.4}/>}</span>;
}
