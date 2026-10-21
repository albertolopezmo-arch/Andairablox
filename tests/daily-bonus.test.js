import test from 'node:test';import assert from 'node:assert/strict';
import {mountDailyBonus} from '../web/daily-bonus.js';
class Element{
 constructor(){this.children=[];this.listeners={};this.isConnected=true;}
 append(...items){this.children.push(...items);}prepend(item){this.children.unshift(item);}setAttribute(){}
 querySelector(){return this.children.find(c=>c.className==='daily-bonus');}
 addEventListener(name,fn){this.listeners[name]=fn;}remove(){this.removed=true;}
}
test('Daily: intersticial antes del botón; cancelar vídeo no cobra; reintentar no duplica el premio',async()=>{
 const original=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{
 const events=[],card=new Element(),values=new Map();let cancel=true;
 await mountDailyBonus(card,{date:'2026-10-17',coins:7,userId:'u',interstitial:true,storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},showAd:async()=>events.push('interstitial'),watchVideo:async()=>{events.push('video');if(cancel)throw Error('cancelado');},rpc:async()=>events.push('claim'),refresh:async()=>events.push('refresh')});
 assert.deepEqual(events,['interstitial']);const box=card.children[0],button=box.children[0];
 await button.listeners.click();assert.deepEqual(events,['interstitial','video']);assert.equal(button.disabled,false);
 cancel=false;await button.listeners.click();assert.deepEqual(events,['interstitial','video','video','claim','refresh']);assert.ok(button.removed);
 }finally{globalThis.document=original;}
});
