import {writeFile} from 'node:fs/promises';
const [urlInput,key]=process.argv.slice(2);let url;
try{url=new URL(urlInput);}catch{throw Error('Uso: node scripts/configure.mjs https://PROYECTO.supabase.co CLAVE_PUBLICABLE');}
if(url.protocol!=='https:'||!key||key.length<20)throw Error('Indica una URL HTTPS y la clave publicable de Supabase.');
const content=`// Configuración pública. No pongas aquí service_role ni secret keys.\nwindow.ANDAIRA_CONFIG = Object.freeze({\n  supabaseUrl: ${JSON.stringify(url.origin)},\n  publishableKey: ${JSON.stringify(key)}\n});\nwindow.ANDAIRA_ANALYTICS_ENDPOINT = ${JSON.stringify(url.origin+'/functions/v1/andairablox/collect')};\n`;
await writeFile(new URL('../web/assets/analytics-config.js',import.meta.url),content);
console.log('Supabase conectado. Panel: https://andairablox.es/admin/');
