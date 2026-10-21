import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDuel,botAttempt,duelWinner} from '../web/duel.js';
// Minimal DOM for controller tests; browser visual QA is performed separately.
class Element{
 constructor(tag){this.tag=tag;this.style={};this.children=[];this.listeners={};this.className='';this.disabled=false;this.ownText='';this.classList={add:(name)=>this.className+=' '+name};}
 set textContent(value){this.ownText=String(value);this.children=[];}get textContent(){return this.ownText+this.children.map(c=>c.textContent).join(' ');}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.ownText='';this.children=children;}
 addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(){}
 querySelectorAll(selector){let found=[];for(const child of this.children){if(selector.startsWith('.')&&child.className.split(' ').includes(selector.slice(1)))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function button(root,text){const walk=e=>[e,...e.children.flatMap(walk)];return walk(root).find(e=>e.tag==='button'&&e.textContent===text);}
function setup(t){const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};t.after(()=>globalThis.document=previous);t.mock.timers.enable({apis:['setTimeout','setInterval']});return new Element('main');}
test('la máquina responde con velocidad y acierto variables',()=>{
 assert.deepEqual(botAttempt(()=>0),{delay:3000,correct:true});assert.deepEqual(botAttempt(()=>.99),{delay:16860,correct:false});
 assert.equal(duelWinner(30,30),'¡Empate!');assert.equal(duelWinner(31,30),'¡Has ganado!');
});
test('la práctica completa cinco preguntas sin enviar premios ni llamadas al servidor',async t=>{
 const root=setup(t);let now=0;let calls=0;const dispose=mountDuel(root,{practiceOnly:true,now:()=>now,rpc:async()=>{calls++;throw Error('No debe llamarse');}});
 await button(root,'JUGAR CONTRA LA MÁQUINA').listeners.click();now+=4301;t.mock.timers.tick(4301);
 for(let i=0;i<5;i++){
  assert.ok(root.textContent.includes(`PREGUNTA ${i+1} DE 5`));
  const answer=root.querySelectorAll('.daily-answer')[0];answer.listeners.click();const score=root.querySelector('.duel-score').textContent;answer.listeners.click();assert.equal(root.querySelector('.duel-score').textContent,score);
  now+=22001;t.mock.timers.tick(22001);
 }
 assert.ok(root.textContent.includes('Vista de prueba'));assert.equal(calls,0);dispose();
});
test('ofrece la máquina tras 25 s y confirma la cancelación antes de cambiar',async t=>{
 const root=setup(t);let now=0;const calls=[];const waiting={id:'d',state:'waiting'};
 const dispose=mountDuel(root,{practiceOnly:true,now:()=>now,rpc:async(name)=>{calls.push(name);return name==='quiz_lqsa_cancel_duel'?{id:'d',state:'cancelled'}:waiting;}});
 await button(root,'BUSCAR OTRO JUGADOR').listeners.click();assert.equal(button(root,'JUGAR CONTRA LA MÁQUINA'),undefined);
 now=26000;t.mock.timers.tick(1000);await flush();
 await button(root,'JUGAR CONTRA LA MÁQUINA').listeners.click();
 assert.ok(calls.includes('quiz_lqsa_cancel_duel'));now+=4301;t.mock.timers.tick(4301);assert.ok(root.textContent.includes('PREGUNTA 1 DE 5'));dispose();
});
test('un rival que entra al cancelar mantiene la partida online',async t=>{
 const root=setup(t);let now=0;const calls=[];
 const dispose=mountDuel(root,{practiceOnly:true,now:()=>now,rpc:async(name)=>{calls.push(name);return name==='quiz_lqsa_cancel_duel'?{id:'d',state:'playing',opponent:{alias:'Vecino'}}:{id:'d',state:'waiting'};}});
 await button(root,'BUSCAR OTRO JUGADOR').listeners.click();now=26000;t.mock.timers.tick(1000);await flush();
 await button(root,'JUGAR CONTRA LA MÁQUINA').listeners.click();assert.ok(root.textContent.includes('RIVAL ENCONTRADO'));assert.ok(root.textContent.includes('Vecino'));dispose();
 const count=calls.length;t.mock.timers.tick(30000);await flush();assert.equal(calls.length,count);
});

test('el vídeo X2 no cobra si se cancela y solo duplica monedas tras completarlo',async t=>{
 const root=setup(t);const calls=[];const memory=new Map();let rejectVideo=true;
 const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const dispose=mountDuel(root,{storage,userId:()=> 'u',showAd:async()=>{calls.push('interstitial');},watchVideo:async()=>{if(rejectVideo)throw Error('Vídeo cancelado');},rpc:async(name)=>{calls.push(name);return name==='quiz_lqsa_start_bot_duel'?{id:'d',state:'finished',is_bot:true,my_score:100,opponent_score:20,opponent:{alias:'Máquina'},reward:{points:100,coins:50,doubled:false}}:{status:'claimed',coins:100};}});
 await button(root,'JUGAR CONTRA LA MÁQUINA').listeners.click();await flush();assert.ok(root.textContent.includes('+100 puntos al ranking · 50 monedas'));
 await button(root,'VER VÍDEO · 50 → 100 MONEDAS').listeners.click();assert.equal(calls.filter(n=>n==='quiz_lqsa_double_duel_coins').length,0);
 rejectVideo=false;await button(root,'VER VÍDEO Y DUPLICAR MONEDAS').listeners.click();assert.equal(calls.filter(n=>n==='quiz_lqsa_double_duel_coins').length,1);assert.ok(root.textContent.includes('+100 puntos al ranking · 100 monedas'));assert.ok(root.textContent.includes('✓ Monedas duplicadas'));assert.equal(calls.filter(n=>n==='interstitial').length,1);assert.ok(calls.indexOf('interstitial')<calls.indexOf('quiz_lqsa_double_duel_coins'));dispose();
});
