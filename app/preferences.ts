export const avatarLabels:Record<string,string>={moon:'月亮',leaf:'叶子',star:'星星',cloud:'云朵',flower:'花',cat:'猫咪',dog:'小狗',rabbit:'兔子',bird:'小鸟',fish:'小鱼',sun:'太阳',coffee:'咖啡',music:'音乐',heart:'爱心',planet:'星球',cherry:'樱桃'};
export const effectLabels:Record<string,string>={fireworks:'烟花',stars:'星星',hearts:'爱心',petals:'花瓣',bubbles:'泡泡',off:'关闭'};
export type Person={id:string;name:string;bio:string;avatar:string;dm:number;spaceName?:string;effect?:string};
export type Social={friends:Person[];following:Person[];incoming:Person[];outgoing:Person[];notes:Record<string,string>};
export const emptySocial:Social={friends:[],following:[],incoming:[],outgoing:[],notes:{}};
export const spaceMessage=(text?:string)=>text==='在这里，做一颗安静的星星。'?'':text||'';
