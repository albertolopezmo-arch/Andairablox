(()=>{'use strict';
const t=window.andairaText||((s)=>s);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const batSVG='<svg class="flying-bat" viewBox="0 0 100 46" fill="currentColor" aria-hidden="true"><path class="bat-left" d="M48 25 Q32 2 3 3 Q15 13 7 26 Q22 15 29 35 Q38 25 48 32Z"/><path class="bat-right" d="M52 25 Q68 2 97 3 Q85 13 93 26 Q78 15 71 35 Q62 25 52 32Z"/><path d="M43 21 43 10 49 16 56 10 57 23 Q65 38 50 44 Q35 38 43 21Z"/></svg>';
document.querySelectorAll('.magic-stage').forEach(stage=>{
 const book=stage.querySelector('.magic-book'),swarm=stage.querySelector('.bat-swarm'),hint=stage.querySelector('[data-book-hint]'),status=stage.querySelector('.magic-status');let cleanup;
 book.disabled=false;
 book.addEventListener('click',()=>{
  const open=book.getAttribute('aria-expanded')!=='true';
  book.classList.toggle('is-open',open);book.setAttribute('aria-expanded',String(open));book.setAttribute('aria-label',open?t('Cerrar el libro de Halloween'):t('Abrir Truco o Trato y descubrir los murciélagos'));
  hint.textContent=open?t('¡Se han escapado! Toca para cerrar.'):t('Toca el libro. Si te atreves.');
  status.textContent=open?t('El libro se abre y salen murciélagos.'):t('Libro cerrado.');
  clearTimeout(cleanup);swarm.replaceChildren();
  if(!open||reduced.matches)return;
  const width=Math.min(stage.clientWidth,500);
  for(let i=0;i<12;i++){
   const wrapper=document.createElement('div');wrapper.innerHTML=batSVG;const bat=wrapper.firstElementChild;
   const direction=i%2===0?-1:1;
   bat.style.setProperty('--dx',`${direction*(width*.3+Math.random()*width*.35)}px`);
   bat.style.setProperty('--dy',`${-(180+Math.random()*260)}px`);
   bat.style.setProperty('--rot',`${direction*(10+Math.random()*28)}deg`);
   bat.style.setProperty('--delay',`${.28+i*.065}s`);bat.style.setProperty('--size',`${27+Math.random()*26}px`);
   swarm.append(bat);
  }
  cleanup=setTimeout(()=>swarm.replaceChildren(),3900);
 });
});
})();
