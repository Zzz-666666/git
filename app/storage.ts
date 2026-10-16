import {resolve,join} from 'node:path';
export const dataDir=resolve(process.env.WANDE_DATA_DIR||join(import.meta.dirname,'data'));
export type Statement={sql:string;values:any[];bind(...values:any[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;all<T=Record<string,unknown>>():Promise<{success:boolean;results:T[]}>;run():Promise<{success:boolean;meta:{changes:number}}>};
export type Database={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<{success:boolean;meta:{changes:number}}[]>};
const cloud=process.env.WANDE_STORAGE==='cloud';
if(!cloud&&(process.env.RENDER==='true'||process.env.DATABASE_URL))throw Error('Set WANDE_STORAGE=cloud; ephemeral local storage is disabled on hosted services');
export const env=cloud?await(await import('./cloud-storage')).cloudEnvironment(): (await import('./local-storage')).env;
