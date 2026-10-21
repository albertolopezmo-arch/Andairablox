export const MILESTONES=[5,10,15,20,25,30];
export function streakDay(days){return days>0?(days-1)%30+1:0;}
export function streakCoins(milestone){if(!MILESTONES.includes(milestone))throw new Error('Objetivo no válido');return 600+(milestone-5)/5*200;}
export function pendingKey(user,cycle,milestone){return `quiz-lqsa-video:${user}:${cycle}:${milestone}`;}
export function watchRewardedVideo(){
 return new Promise((resolve,reject)=>{
  if(!window.QuizRewardAds?.postMessage){reject(new Error('El vídeo de bonificación está disponible en la app Android.'));return;}
  const id=crypto.randomUUID();
  const handle=event=>{let message;try{message=JSON.parse(event.data);}catch{return;}if(message.id!==id)return;cleanup();message.rewarded?resolve():reject(new Error(message.error||'Completa el vídeo para recibir las monedas.'));};
  const timeout=setTimeout(()=>{cleanup();reject(new Error('El vídeo no respondió. Inténtalo de nuevo.'));},300000);
  function cleanup(){clearTimeout(timeout);window.QuizRewardAds.removeEventListener('message',handle);}
  window.QuizRewardAds.addEventListener('message',handle);
  window.QuizRewardAds.postMessage(JSON.stringify({id,action:'watch'}));
 });
}

export function showInterstitial(){
 if(!window.QuizRewardAds?.postMessage)return Promise.resolve();
 return new Promise(resolve=>{
  const bridge=window.QuizRewardAds,id=crypto.randomUUID();
  const handle=event=>{let message;try{message=JSON.parse(event.data);}catch{return;}if(message.id===id){cleanup();resolve();}};
  const timeout=setTimeout(()=>{cleanup();resolve();},300000);
  function cleanup(){clearTimeout(timeout);bridge.removeEventListener('message',handle);}
  bridge.addEventListener('message',handle);bridge.postMessage(JSON.stringify({id,action:'interstitial'}));
 });
}
