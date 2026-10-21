(()=>{'use strict';
const t=window.andairaText||((s)=>s);
const pages=[{file:'halloween-muestra-1.png',name:t('Especial Halloween'),w:382,h:572},{file:'halloween-muestra-2.png',name:t('Portadilla: Andairablox, Truco o Trato'),w:360,h:537},{file:'halloween-muestra-3.png',name:t('Capítulo 1: La llegada de Halloween'),w:367,h:542},{file:'halloween-muestra-4.png',name:t('Inicio del capítulo: El viento susurraba entre los árboles'),w:355,h:538}];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.magic-stage').forEach(stage=>{
 const book=stage.querySelector('.magic-book'),controls=stage.querySelector('.sample-controls'),dialog=stage.querySelector('.sample-dialog');if(!controls||!dialog)return;
 const inline=stage.querySelector('.sample-inline'),full=dialog.querySelector('.sample-full'),area=dialog.querySelector('.sample-image-area'),zoom=dialog.querySelector('[data-sample-zoom]');let index=0,swipeStart=null,autoTimer;
 function stopAuto(){clearTimeout(autoTimer);}
 function scheduleAuto(){stopAuto();if(book.getAttribute('aria-expanded')!=='true'||dialog.open||document.hidden)return;autoTimer=setTimeout(()=>{if(index<pages.length-1){index++;render(true);scheduleAuto();}else{book.click();}},index===pages.length-1?6000:3000);}
 pages.forEach(page=>{const image=new Image();image.src='/assets/'+page.file;});
 function render(animate=false){const p=pages[index];for(const img of [inline,full]){img.src='/assets/'+p.file;img.width=p.w;img.height=p.h;}full.alt=(document.documentElement?.lang==='en'?`Sample page ${index+1} of ${pages.length} (Spanish): ${p.name}`:document.documentElement?.lang==='fr'?`Extrait ${index+1} sur ${pages.length} (espagnol) : ${p.name}`:`Página de muestra ${index+1} de ${pages.length}: ${p.name}`);stage.querySelectorAll('[data-sample-counter]').forEach(x=>x.textContent=`${index+1} / ${pages.length}`);stage.querySelectorAll('[data-sample-prev]').forEach(x=>x.disabled=index===0);stage.querySelectorAll('[data-sample-next]').forEach(x=>x.disabled=index===pages.length-1);area.scrollTop=0;if(animate&&!reduced.matches){for(const img of [inline,full])img.animate([{opacity:.25,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}],{duration:230,easing:'ease-out'});}}
 function turn(direction){const next=Math.max(0,Math.min(pages.length-1,index+direction));if(index!==next){index=next;render(true);scheduleAuto();}}
 stage.querySelectorAll('[data-sample-prev]').forEach(x=>x.addEventListener('click',()=>turn(-1)));stage.querySelectorAll('[data-sample-next]').forEach(x=>x.addEventListener('click',()=>turn(1)));
 book.addEventListener('click',()=>{const open=book.getAttribute('aria-expanded')==='true';controls.hidden=!open;stopAuto();if(open){index=0;render();stage.querySelector('[data-book-hint]').textContent=t('La muestra pasa sola. Después, el libro se cierra.');stage.querySelector('.magic-status').textContent=t('Libro abierto. Las cuatro páginas pasan automáticamente.');scheduleAuto();}});
 stage.querySelector('[data-sample-enlarge]').addEventListener('click',()=>{stopAuto();render();dialog.showModal();});
 dialog.querySelector('[data-sample-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',scheduleAuto);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAuto();else scheduleAuto();});
 window.addEventListener('pagehide',stopAuto);
 zoom.addEventListener('click',()=>{const enlarged=dialog.classList.toggle('is-zoomed');zoom.setAttribute('aria-pressed',String(enlarged));zoom.textContent=enlarged?t('Ajustar −'):t('Ampliar +');});
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();turn(1);}if(event.key==='ArrowLeft'){event.preventDefault();turn(-1);}});
 area.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!dialog.classList.contains('is-zoomed'))swipeStart={x:e.clientX,y:e.clientY};});
 area.addEventListener('pointerup',e=>{if(!swipeStart)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)turn(dx<0?1:-1);});area.addEventListener('pointercancel',()=>swipeStart=null);
 render();
});
})();
