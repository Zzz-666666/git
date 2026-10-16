import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,join,dirname} from 'node:path';
import {cp,mkdir,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const root=import.meta.dirname,require=createRequire(existsSync(join(root,'node_modules/vite'))?join(root,'package.json'):resolve(root,'../wandeng/package.json'));
const {build:buildWeb,defineConfig}=await import(pathToFileURL(require.resolve('vite')).href);
const react=(await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href)).default;

let esbuildPath;try{esbuildPath=require.resolve('esbuild')}catch{const store=resolve(root,'../wandeng/node_modules/.pnpm');const directory=(await readdir(store)).find(n=>/^esbuild@0\.28\./.test(n));if(!directory)throw Error('Install build dependencies first');esbuildPath=resolve(store,directory,'node_modules/esbuild/lib/main.js')}
const {build:buildServer}=await import(pathToFileURL(esbuildPath).href);
const aliases=Object.fromEntries(['react','react-dom','lucide-react'].map(name=>[name,dirname(require.resolve(name+'/package.json'))]));
const out=resolve(root,'dist');await mkdir(out,{recursive:true});
await buildWeb(defineConfig({root,configFile:false,plugins:[react()],resolve:{alias:aliases},css:{postcss:{plugins:[]}},build:{outDir:join(out,'client'),emptyOutDir:true}}));
await buildServer({entryPoints:[join(root,'server.ts'),join(root,'import-data.ts')],outdir:out,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',target:'node24',format:'esm',external:['node:*','pg'],logLevel:'info'});
await cp(join(root,'cloud-schema.sql'),join(out,'cloud-schema.sql'));
await cp(join(root,'migrations'),join(out,'migrations'),{recursive:true});await cp(join(root,'package.json'),join(out,'package.json'));
console.log('Independent deployment prepared at '+out);
