import sharp from 'file:///C:/Users/ALBERTO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {STORE_ITEMS,stickerSvg,wallpaperSvg} from './web/store.js';

const output=new URL('./store-preview/',import.meta.url);
await mkdir(output,{recursive:true});
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const packs=STORE_ITEMS.filter(item=>item.kind==='stickers');
const stickerLayers=[];
for(let pack=0;pack<packs.length;pack++)for(let i=0;i<packs[pack].stickers.length;i++){
 const sticker=packs[pack].stickers[i];
 const image=typeof sticker==='string'
  ? await sharp(Buffer.from(stickerSvg(sticker,packs[pack].accent))).resize(248,248).png().toBuffer()
  : await sharp(fileURLToPath(new URL(`./web/${sticker.asset}`,import.meta.url))).resize(248,248,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 stickerLayers.push({input:image,left:63+i*340,top:160+pack*378});
}
const stickerBoard=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="920"><rect width="100%" height="100%" fill="#faf4e7"/><text x="700" y="58" text-anchor="middle" font-family="Arial" font-weight="900" font-size="42" fill="#111">STICKERS PARA WHATSAPP</text><text x="700" y="103" text-anchor="middle" font-family="Arial" font-weight="700" font-size="22" fill="#514b3f">PNG transparentes · 4 diseños por pack</text>${packs.map((pack,row)=>{const y=132+row*378;return `<text x="38" y="${y}" font-family="Arial" font-weight="900" font-size="24" fill="#111">${escape(pack.title)}</text>${pack.stickers.map((_,i)=>`<rect x="${38+i*340}" y="${y+14}" width="312" height="330" rx="20" fill="${pack.accent==='pink'?'#ffedf7':'#fff9df'}" stroke="#111" stroke-width="4"/>`).join('')}`}).join('')}</svg>`;
const stickers=await sharp(Buffer.from(stickerBoard)).composite(stickerLayers).png().toBuffer();
await writeFile(new URL('stickers.png',output),stickers);
const wallpapers=STORE_ITEMS.filter(item=>item.kind==='wallpaper');
const wallLayers=[];
for(let i=0;i<wallpapers.length;i++){
 const image=await sharp(Buffer.from(wallpaperSvg(wallpapers[i].id))).resize(300,667).png().toBuffer();
 wallLayers.push({input:image,left:45+i*390,top:142});
}
const wallBoard=`<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="940"><rect width="100%" height="100%" fill="#faf4e7"/><text x="610" y="58" text-anchor="middle" font-family="Arial" font-weight="900" font-size="42" fill="#111">FONDOS PARA EL MÓVIL</text>${wallpapers.map((item,i)=>`<rect x="${35+i*390}" y="130" width="320" height="745" rx="24" fill="#fffaf0" stroke="#111" stroke-width="4"/><text x="${195+i*390}" y="908" text-anchor="middle" font-family="Arial" font-weight="900" font-size="20" fill="#111">${escape(item.title)}</text>`).join('')}</svg>`;
const wallImage=await sharp(Buffer.from(wallBoard)).composite(wallLayers).png().toBuffer();
await writeFile(new URL('fondos.png',output),wallImage);
