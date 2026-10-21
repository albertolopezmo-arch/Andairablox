import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STORE_ITEMS,mountStore} from '../web/store.js';
import {mountBloopers} from '../web/bloopers.js';

class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.className='';this.disabled=false;this.ownText='';}
 set textContent(value){this.ownText=String(value);this.children=[];}get textContent(){return this.ownText+this.children.map(child=>child.textContent).join(' ');}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.ownText='';this.children=children;}
 addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(name,value){this.attributes[name]=value;}
}

test('la tienda publica solo el vídeo de tomas falsas y su precio coincide con Supabase',()=>{
 assert.deepEqual(STORE_ITEMS.map(({id,price,kind})=>({id,price,kind})),[{id:'video-bloopers',price:300,kind:'video'}]);
 const sql=readFileSync(new URL('../backend/012_store_video.sql',import.meta.url),'utf8');
 assert.match(sql,/when 'video-bloopers' then 300/);
 assert.doesNotMatch(sql,/when '(stickers-|wallpaper-)/);
 assert.match(sql,/check\(item_id in\([^)]*'video-bloopers'\)\)/);
});

test('un canje confirmado habilita abrir el vídeo y actualiza el saldo',async t=>{
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};t.after(()=>globalThis.document=previous);
 const root=new Element('main');const bought=[];let coins=500;let opened=0;
 await mountStore(root,{getOwned:async()=>[],buyItem:async id=>{bought.push(id);coins-=300;},balance:()=>coins,onPurchased:async()=>{},openVideo:()=>opened++});
 const findButton=text=>{const walk=node=>[node,...node.children.flatMap(walk)];return walk(root).find(node=>node.tag==='button'&&node.textContent===text);};
 await findButton('CANJEAR · 300 MONEDAS').listeners.click();
 assert.deepEqual(bought,['video-bloopers']);
 assert.ok(root.textContent.includes('Vídeo desbloqueado'));
 assert.ok(root.textContent.includes('200 monedas'));
 await findButton('▶ VER VÍDEO').listeners.click();
 assert.equal(opened,1);
});

test('un vídeo ya comprado se muestra como acceso directo sin volver a cobrar',async t=>{
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};t.after(()=>globalThis.document=previous);
 const root=new Element('main');
 await mountStore(root,{getOwned:async()=>['video-bloopers'],buyItem:async()=>assert.fail('no debe volver a cobrar'),balance:()=>42});
 assert.ok(root.textContent.includes('▶ VER VÍDEO'));
 assert.ok(!root.textContent.includes('CANJEAR'));
});

test('la página abre el reproductor incrustado y conserva la alternativa de YouTube',t=>{
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};t.after(()=>globalThis.document=previous);
 const root=new Element('main');mountBloopers(root);
 const walk=node=>[node,...node.children.flatMap(walk)];
 const frame=walk(root).find(node=>node.tag==='iframe');
 const link=walk(root).find(node=>node.tag==='a');
 assert.equal(frame.src,'https://www.youtube-nocookie.com/embed/hZwudljbhas?playsinline=1&rel=0');
 assert.equal(frame.title,'Tomas falsas de La que se avecina');
 assert.equal(link.href,'https://www.youtube.com/watch?v=hZwudljbhas');
});
