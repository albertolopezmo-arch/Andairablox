import {showInterstitial,watchRewardedVideo} from './streak-rewards.js';
export async function mountDailyBonus(card,{date,coins,doubled=false,userId,rpc,refresh,interstitial=false,storage=localStorage,showAd=showInterstitial,watchVideo=watchRewardedVideo}){
 if(card.querySelector('.daily-bonus'))return;
 const box=document.createElement('div');box.className='daily-bonus';card.append(box);
 if(interstitial){await showAd();if(!card.isConnected)return;}
 if(!coins)return;
 const status=document.createElement('p');status.setAttribute('role','status');box.append(status);
 if(doubled){status.textContent='✓ Monedas del Daily duplicadas.';return;}
 const button=document.createElement('button');button.type='button';button.className='daily-next';button.textContent=`VER VÍDEO Y DUPLICAR MONEDAS · ${coins} → ${coins*2}`;box.prepend(button);
 const key=`quiz-lqsa-daily-video:${userId}:${date}`;
 button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Preparando bonificación…';
  try{
   if(!storage.getItem(key)){await watchVideo();storage.setItem(key,'earned');}
   await rpc('quiz_lqsa_double_daily_coins',{p_date:date});storage.removeItem(key);
   status.textContent=`✓ ${coins*2} monedas en total. Los puntos no cambian.`;button.remove();await refresh();
  }catch(error){status.textContent=error.message||'No se pudo cobrar. Puedes reintentar.';button.disabled=false;}
 });
}
