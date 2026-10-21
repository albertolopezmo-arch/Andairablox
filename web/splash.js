(()=>{
 const overlay=document.querySelector('#app-splash'),art=document.querySelector('#splash-art');
 let started=false;
 function start(){
  if(started)return;started=true;
  const begin=performance.now(),bar=document.querySelector('#splash-progress'),fill=document.querySelector('#splash-fill');
  const timer=setInterval(()=>{const progress=Math.min(100,(performance.now()-begin)/60);fill.style.width=`${progress}%`;bar.setAttribute('aria-valuenow',String(Math.floor(progress)));},50);
  setTimeout(()=>{
   clearInterval(timer);document.querySelector('.app-shell').removeAttribute('inert');overlay.remove();document.body.classList.remove('splash-open');
   window.QuizRewardAds?.postMessage(JSON.stringify({id:'splash',action:'splash-finished'}));
  },6000);
 }
 if(art.complete)start();else{art.addEventListener('load',start,{once:true});art.addEventListener('error',start,{once:true});}
})();
