import {mountDailyBonus} from './daily-bonus.js';
import {CHARACTER_PROFILES} from './character-profiles.js';
import {mountDuel} from './duel.js';
import {MILESTONES,streakDay,streakCoins,pendingKey,watchRewardedVideo} from './streak-rewards.js';
import {dailyReward} from './daily-scoring.js';
import { StatsRepository } from './stats.js';
import {AVATAR_IDS,avatarAssetPath,loadProfile,saveProfile,validateAlias,suggestAlias} from './profile.js';
import {createDailyRound} from './daily-questions.js';
import {SupabaseClient} from './supabase.js';
import {mountStore} from './store.js';
import {mountBloopers} from './bloopers.js';
let profile=loadProfile(localStorage);
let selectedAvatar=profile?.avatar||null;
let avatarPage=0;
let setupOpen=false;
const sections = {
  daily: {title:'Daily', icon:'', copy:'', notice:''},
  duel: {title:'Duelo', icon:'', copy:'Compite contra otros vecinos y demuestra quién sabe más.', notice:'Próximamente podrás retar a otros jugadores.'},
  ranking: {title:'Ranking', icon:'', copy:'El barrio tiene sitio para un número uno.', notice:'Todavía no hay clasificaciones.'},
  shop: {title:'Tienda', icon:'✦', copy:'Canjea tus monedas por contenido exclusivo.', notice:''},
  bloopers: {title:'Tomas falsas', icon:'▶', copy:'Vídeo desbloqueado para tu cuenta.', notice:''},
  profile: {title:'Perfil', icon:'', copy:'Tu rincón en el barrio. Aquí verás tu progreso y tus estadísticas.'}
};
let stats = {points:0,coins:0,dailyCompletedDate:null,dailyLastScore:0,streakDays:0,rewardCycle:null,claimedMilestones:[]};
const supabase = new SupabaseClient(window.QUIZ_SUPABASE,localStorage);
const repository = new StatsRepository(window.QUIZ_SUPABASE, () => window.quizSession || null,supabase);
let sessionError='';
let sessionInitialization;
function initializeSession(){
 sessionInitialization=supabase.initializeSession().then(session=>{
   window.quizSession=session;sessionError='';return repository.registerDailyVisit().then(()=>{window.dispatchEvent(new Event('quiz-session-changed'));return session;});
 }).catch(error=>{sessionError=error.message||'No se pudo conectar con Supabase.';return null;});
 return sessionInitialization;
}
initializeSession();
const number = new Intl.NumberFormat('es-ES');
const DAILY_SEEN_KEY='quiz-lqsa-daily-seen-v1';
let dailyRound=null,dailyIndex=0,dailyScore=0,dailySeconds=20,dailyTimer=null,dailyAnswered=false,dailySubmission=null,dailyCorrectTimes=[],dailyDeadline=0;
function drawWalletProfile(){
  const image=document.querySelector('#wallet-avatar');
  image.hidden=!profile;
  if(profile)image.src=avatarAssetPath(profile.avatar);
  const alias=document.querySelector('#wallet-alias');
  alias.textContent=profile?.alias||'Tu perfil';
  alias.title=profile?.alias||'Tu perfil';
}
function drawStats(){
  drawWalletProfile();
  document.querySelector('#wallet-streak').textContent=number.format(stats.streakDays||0);
  document.querySelector('#points').textContent=number.format(stats.points);
  document.querySelector('#coins').textContent=number.format(stats.coins);
  if(location.hash==='#profile')drawProfile();
}
function drawProfile(){
  const content=document.querySelector('#section-content');content.replaceChildren();
  const card=document.createElement('div');card.className='section-card';
  if(profile){const heading=document.createElement('div');heading.className='profile-card-heading';const image=document.createElement('img');image.src=avatarAssetPath(profile.avatar);image.alt='Tu avatar';const alias=document.createElement('strong');alias.textContent=profile.alias;heading.append(image,alias);card.append(heading);}
  const character=CHARACTER_PROFILES[profile?.avatar];
  if(character){
   const info=document.createElement('section');info.className='character-fact';
   const name=document.createElement('h2');name.textContent=character.name;
   const curiosity=document.createElement('p');curiosity.textContent=character.curiosity;
   const quote=document.createElement('blockquote');quote.textContent=`«${character.quote}»`;
   info.append(name,curiosity,quote);card.append(info);
  }
  for(const [label,value] of [['Puntos',stats.points],['Monedas',stats.coins],['Racha',stats.streakDays||0]]){
    const row=document.createElement('div');row.className='stat-row';
    const title=document.createElement('span');title.textContent=label;
    const amount=document.createElement('strong');amount.textContent=number.format(value);
    row.append(title,amount);card.append(row);
  }content.append(card);
  drawStreakRewards(content);
}
let claimingStreak=false;
function drawStreakRewards(content){
 const panel=document.createElement('section');panel.className='section-card streak-rewards';
 const heading=document.createElement('h2');heading.textContent='RECOMPENSAS DE RACHA';
 const copy=document.createElement('p');copy.textContent='Entra cada día. Cada 5 días consecutivos desbloqueas monedas viendo un vídeo. Los premios se repiten en ciclos de 30 días.';
 panel.append(heading,copy);
 const cycleDay=streakDay(stats.streakDays||0);
 for(const milestone of MILESTONES){
  const row=document.createElement('div');row.className='streak-reward-row';
  const label=document.createElement('span');label.textContent=`${milestone} días · ${streakCoins(milestone)} monedas`;
  const button=document.createElement('button');button.type='button';
  const claimed=(stats.claimedMilestones||[]).includes(milestone);
  const key=pendingKey(window.quizSession?.user?.id,stats.rewardCycle,milestone);
  button.textContent=claimed?'✓ Cobrado':cycleDay<milestone?`${cycleDay}/${milestone}`:localStorage.getItem(key)?'Reintentar':'Ver vídeo y cobrar';
  button.disabled=claimingStreak||claimed||cycleDay<milestone||!stats.rewardCycle||stats.rewardsUnavailable;
  button.addEventListener('click',()=>claimStreakReward(milestone));row.append(label,button);panel.append(row);
 }
 const status=document.createElement('p');status.id='streak-status';status.setAttribute('role','status');status.textContent=stats.rewardsUnavailable?'Las recompensas de racha no están disponibles. Comprueba la conexión y que esté cargado el SQL de actualización.':streakMessage;panel.append(status);content.append(panel);
}
let streakMessage='';
async function claimStreakReward(milestone){
 if(claimingStreak)return;
 claimingStreak=true;const cycle=stats.rewardCycle;const user=window.quizSession?.user?.id;
 const key=pendingKey(user,cycle,milestone);
 streakMessage='Cargando vídeo de bonificación…';drawProfile();
 try{
  if(!localStorage.getItem(key)){await watchRewardedVideo();localStorage.setItem(key,'completed');}
  if(user!==window.quizSession?.user?.id)throw new Error('La sesión ha cambiado.');
  const result=await repository.claimStreak(milestone,cycle);
  localStorage.removeItem(key);streakMessage=result?.status==='already_claimed'?'Este premio ya estaba cobrado.':`¡Has ganado ${result.reward} monedas!`;
  stats=await repository.fetchStats();drawStats();
 }catch(error){streakMessage=error.message||'No se pudo cobrar. Vuelve a intentarlo.';}
 finally{claimingStreak=false;if(location.hash==='#profile')drawProfile();}
}
function stopDailyTimer(){if(dailyTimer){clearInterval(dailyTimer);dailyTimer=null;}}
function dailySeen(){try{return JSON.parse(localStorage.getItem(DAILY_SEEN_KEY)||'[]').filter(id=>typeof id==='string');}catch{return [];}}
function todayInSpain(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${values.year}-${values.month}-${values.day}`;
}
function showDailyNotice(titleText,messageText,buttonText,onButton){
 const content=document.querySelector('#section-content');content.replaceChildren();const card=document.createElement('section');card.className='daily-result';
 const title=document.createElement('h2');title.textContent=titleText;const message=document.createElement('p');message.textContent=messageText;card.append(title,message);
 if(buttonText){const button=document.createElement('button');button.type='button';button.className='daily-next';button.textContent=buttonText;button.addEventListener('click',onButton);card.append(button);}content.append(card);
}
async function buildDaily(){
 stopDailyTimer();
 showDailyNotice('Preparando tu Daily','Conectando con tu cuenta para guardar tus puntos…');
 const session=await sessionInitialization;if(location.hash!=='#daily')return;
 if(!session){showDailyNotice('No se pudo conectar',sessionError||'Conéctate a internet para iniciar el Daily y guardar tus puntos.','REINTENTAR',()=>{initializeSession();buildDaily();});return;}
 try{stats=await repository.fetchStats();drawStats();}catch(error){showDailyNotice('No se pudo cargar tu cuenta',error.message||'Revisa tu conexión e inténtalo de nuevo.','REINTENTAR',()=>{initializeSession();buildDaily();});return;}
 if(stats.dailyCompletedDate===todayInSpain()){
   showDailyNotice('Daily completado por hoy',`Ya respondiste el desafío de hoy: ${stats.dailyLastScore} de 10 correctas. Vuelve mañana para sumar más puntos.`);offerDailyBonus(document.querySelector('#section-content .daily-result'));return;
 }
 const pending=pendingDaily();
 if(pending){
  showDailyNotice('Resultado pendiente',`${pending.score} de 10 respuestas correctas. Recuperando el guardado…`);
  const card=document.querySelector('#section-content .daily-result');saveDailyResult(card.querySelector('p'),card,pending);return;
 }
 const content=document.querySelector('#section-content');content.replaceChildren();dailySubmission=null;
 const seen=dailySeen();dailyRound=createDailyRound(Math.random,seen,10);dailyIndex=0;dailyScore=0;dailyCorrectTimes=[];
 try{localStorage.setItem(DAILY_SEEN_KEY,JSON.stringify(dailyRound.seenIds));}catch{}
 const shell=document.createElement('section');shell.className='daily-game';shell.setAttribute('aria-label','Partida Daily');
 const top=document.createElement('div');top.className='daily-topline';
 const progress=document.createElement('strong');progress.className='daily-progress';
 const timer=document.createElement('div');timer.className='daily-clock';timer.setAttribute('role','timer');timer.setAttribute('aria-live','off');
 const timerText=document.createElement('span');timerText.className='daily-clock-text';
 const bar=document.createElement('span');bar.className='daily-clock-bar';timer.append(timerText,bar);top.append(progress,timer);
 const track=document.createElement('div');track.className='daily-progress-track';track.setAttribute('aria-hidden','true');
 const trackFill=document.createElement('span');track.append(trackFill);
 const card=document.createElement('div');card.className='daily-question-card';
 const question=document.createElement('h2');question.className='daily-question';
 const answers=document.createElement('div');answers.className='daily-answers';answers.setAttribute('role','group');answers.setAttribute('aria-label','Elige una respuesta');
 const feedback=document.createElement('p');feedback.className='daily-feedback';feedback.setAttribute('aria-live','polite');
 const next=document.createElement('button');next.type='button';next.className='daily-next';next.hidden=true;
 card.append(question,answers,feedback,next);shell.append(top,track,card);content.append(shell);
 next.addEventListener('click',()=>{if(dailyIndex<dailyRound.questions.length-1){dailyIndex++;showDailyQuestion();}else showDailyResult();});
 shell._daily={progress,timer,timerText,bar,trackFill,question,answers,feedback,next};showDailyQuestion();
}
function showDailyQuestion(){
 stopDailyTimer();dailySeconds=20;dailyAnswered=false;
 const ui=document.querySelector('.daily-game')?._daily;if(!ui||!dailyRound)return;
 const item=dailyRound.questions[dailyIndex];
 ui.progress.textContent=`PREGUNTA ${dailyIndex+1} DE ${dailyRound.questions.length}`;
 ui.trackFill.style.width=`${dailyIndex/dailyRound.questions.length*100}%`;
 ui.question.textContent=item.prompt;ui.answers.replaceChildren();ui.feedback.textContent='';ui.feedback.className='daily-feedback';ui.next.hidden=true;
 item.options.forEach((option,index)=>{const button=document.createElement('button');button.type='button';button.className='daily-answer';button.textContent=option;button.addEventListener('click',()=>answerDaily(index));ui.answers.append(button);});
 dailyDeadline=performance.now()+20000;updateDailyClock();dailyTimer=setInterval(()=>{dailySeconds=Math.max(0,Math.ceil((dailyDeadline-performance.now())/1000));updateDailyClock();if(dailySeconds<=0)answerDaily(-1);},100);
}
function updateDailyClock(){const ui=document.querySelector('.daily-game')?._daily;if(!ui)return;ui.timerText.textContent=`${dailySeconds}s`;ui.bar.style.height=`${dailySeconds/20*100}%`;ui.timer.classList.toggle('is-low',dailySeconds<=5);}
function answerDaily(index){
 if(dailyAnswered)return;dailyAnswered=true;stopDailyTimer();const ui=document.querySelector('.daily-game')?._daily;if(!ui)return;
 const remaining=Math.max(0,Math.min(20000,Math.floor(dailyDeadline-performance.now())));if(remaining===0)index=-1;
 const item=dailyRound.questions[dailyIndex];const buttons=[...ui.answers.querySelectorAll('button')];buttons.forEach((button,i)=>{button.disabled=true;if(i===item.correctIndex)button.classList.add('is-correct');if(i===index&&i!==item.correctIndex)button.classList.add('is-wrong');});
 if(index===item.correctIndex){dailyScore++;dailyCorrectTimes.push(remaining);const reward=dailyReward(remaining);ui.feedback.textContent=`¡Correcto! +${reward.points} puntos · +${reward.coins} monedas`;ui.feedback.classList.add('is-correct-text');}
 else{ui.feedback.textContent=index<0?`Se acabó el tiempo. La respuesta era: ${item.answer}`:`La respuesta era: ${item.answer}`;ui.feedback.classList.add('is-wrong-text');}
 ui.trackFill.style.width=`${(dailyIndex+1)/dailyRound.questions.length*100}%`;
 ui.next.textContent=dailyIndex===dailyRound.questions.length-1?'VER RESULTADO':'SIGUIENTE';ui.next.hidden=false;ui.next.focus({preventScroll:true});
}
function showDailyResult(){
 stopDailyTimer();const content=document.querySelector('#section-content');content.replaceChildren();
 const card=document.createElement('section');card.className='daily-result';card.setAttribute('aria-live','polite');
 const icon=document.createElement('span');icon.className='daily-result-icon';icon.textContent=dailyScore>=8?'🏆':dailyScore>=5?'⭐':'📺';
 const title=document.createElement('h2');title.textContent=dailyScore>=8?'¡Vecino de honor!':dailyScore>=5?'¡Buen trabajo!':'¡A seguir viendo la serie!';
 const score=document.createElement('p');score.className='daily-result-score';score.textContent=`${dailyScore} de ${dailyRound.questions.length} respuestas correctas`;
 const note=document.createElement('p');note.textContent='Guardando tus puntos y monedas…';
 card.append(icon,title,score,note);content.append(card);
 const pending={date:todayInSpain(),times:[...dailyCorrectTimes],score:dailyScore};
 try{localStorage.setItem(dailyPendingKey(),JSON.stringify(pending));}catch{}
 saveDailyResult(note,card,pending);
}
function dailyPendingKey(){return `quiz-lqsa-daily-pending:${window.quizSession?.user?.id}`;}
function pendingDaily(){try{const value=JSON.parse(localStorage.getItem(dailyPendingKey())||'null');return value?.date===todayInSpain()&&Array.isArray(value.times)?value:null;}catch{return null;}}
async function saveDailyResult(note,card,pending){
 if(dailySubmission)return;
 const owner=window.quizSession?.user?.id;const key=dailyPendingKey();
 const retry=card.querySelector('.daily-retry');if(retry)retry.remove();
 note.textContent='Guardando tus puntos y monedas…';
 dailySubmission=(async()=>{
  try{
   const session=await supabase.initializeSession();
   if(!session||session.user.id!==owner)throw Error('No se ha podido recuperar la cuenta de esta partida.');
   window.quizSession=session;
   const award=await repository.submitDaily(pending.times);
   localStorage.removeItem(key);
   note.textContent=`Guardado: +${Number(award?.points_awarded)||0} puntos y +${Number(award?.coins_awarded)||0} monedas. Vuelve mañana para jugar otra vez.`;
   try{stats=await repository.fetchStats();drawStats();}catch{}
   offerDailyBonus(card,Number(award?.coins_awarded)||0,pending.date,true);
  }catch(error){
   let confirmed=false;
   try{stats=await repository.fetchStats();drawStats();confirmed=stats.dailyCompletedDate===pending.date;}catch{}
   if(confirmed){localStorage.removeItem(key);note.textContent=`Tu Daily ya está guardado: ${stats.dailyLastScore} de 10 correctas. Tienes ${number.format(stats.points)} puntos.`;offerDailyBonus(card);return;}
   const detail=error.message||'Error de conexión';
   const missing=/quiz_lqsa_submit_daily|schema cache|PGRST202/i.test(detail);
   note.textContent=missing?'Supabase necesita el SQL ACTUALIZAR-SUPABASE.sql para guardar los premios del Daily. Tu resultado queda pendiente.':`Resultado pendiente de guardar. ${detail}`;
   const button=document.createElement('button');button.type='button';button.className='daily-next daily-retry';button.textContent='REINTENTAR GUARDADO';button.addEventListener('click',()=>saveDailyResult(note,card,pending));card.append(button);
  }
 })();
 try{await dailySubmission;}finally{dailySubmission=null;}
}

function offerDailyBonus(card,coins=stats.dailyBaseCoins||0,date=stats.dailyCompletedDate,interstitial=false){
 if(!card)return;
 mountDailyBonus(card,{date,coins,doubled:stats.dailyCoinsDoubled||false,userId:window.quizSession?.user?.id,
 rpc:async(name,args)=>{const session=await supabase.initializeSession();if(!session)throw Error('No hay conexión con tu cuenta.');window.quizSession=session;return supabase.rpc(name,args,session);},refresh,interstitial}).catch(()=>{});
}
function renderRankingStatus(title,message){
 const content=document.querySelector('#section-content');content.replaceChildren();const card=document.createElement('section');card.className='daily-result';const heading=document.createElement('h2');heading.textContent=title;const text=document.createElement('p');text.textContent=message;card.append(heading,text);content.append(card);
}
function rankingPlayer(player,index,compact=false){
 const position=Number(player.position)||index+1;const row=document.createElement('article');row.className=compact?'ranking-podium-player':'ranking-player-row';row.dataset.position=String(position);
 const avatar=document.createElement('img');avatar.className='ranking-avatar';avatar.src=avatarAssetPath(AVATAR_IDS.includes(player.avatar_id)?player.avatar_id:'avatar-1');avatar.alt=`Avatar de ${player.alias||'vecino'}`;avatar.loading='lazy';
 const rank=document.createElement('strong');rank.className='ranking-player-position';rank.textContent=String(position);
 const alias=document.createElement('span');alias.className='ranking-player-alias';alias.textContent=player.alias||'Vecino';
 const points=document.createElement('strong');points.className='ranking-player-points';points.textContent=`${number.format(Number(player.points)||0)} pts`;
 if(compact){const title=document.createElement('span');title.className='ranking-office';title.textContent=['Presidente','Vicepresi','Richerger'][position-1]||'';row.append(title,avatar,rank,alias,points);}else row.append(rank,avatar,alias,points);return row;
}
async function renderRanking(){
 renderRankingStatus('Cargando ranking','Buscando a los 20 vecinos con más puntos…');
 try{
   const players=await repository.fetchTopPlayers();if(location.hash!=='#ranking')return;
   const content=document.querySelector('#section-content');content.replaceChildren();
   if(!players.length){renderRankingStatus('Aún no hay ranking','Cuando haya jugadores con alias y puntos, aparecerán aquí los 20 primeros.');return;}
   const top=players.slice(0,3);const podium=document.createElement('div');podium.className='ranking-podium';podium.setAttribute('aria-label','Podio de los tres primeros');
   top.forEach((player,index)=>podium.append(rankingPlayer(player,index,true)));
   const list=document.createElement('div');list.className='ranking-list';list.setAttribute('aria-label','Puestos del 4 al 20');
   players.slice(3,20).forEach((player,index)=>list.append(rankingPlayer(player,index+3,false)));
   content.append(podium,list);
 }catch(error){if(location.hash==='#ranking')renderRankingStatus('No se pudo cargar el ranking',error.message||'Revisa tu conexión e inténtalo de nuevo.');}
}
// Horizontal gestures change avatar pages; vertical gestures keep scrolling the form.
const avatarGrid=document.querySelector('#avatar-grid');
let avatarGesture=null,avatarIgnoreClickUntil=0;
avatarGrid.addEventListener('pointerdown',event=>{
 if(!event.isPrimary||event.button!==0)return;
 avatarGesture={id:event.pointerId,x:event.clientX,y:event.clientY};
},{passive:true});
avatarGrid.addEventListener('pointerup',event=>{
 const gesture=avatarGesture;avatarGesture=null;
 if(!gesture||gesture.id!==event.pointerId)return;
 const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
 if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.4)return;
 avatarIgnoreClickUntil=performance.now()+400;
 const nextPage=Math.max(0,Math.min(Math.ceil(AVATAR_IDS.length/12)-1,avatarPage+(dx<0?1:-1)));
 if(nextPage!==avatarPage){avatarPage=nextPage;renderAvatars();}
},{passive:true});
avatarGrid.addEventListener('pointercancel',()=>{avatarGesture=null;},{passive:true});
avatarGrid.addEventListener('click',event=>{
 if(performance.now()<avatarIgnoreClickUntil){event.preventDefault();event.stopImmediatePropagation();}
},true);
function renderAvatars(){
 const grid=document.querySelector('#avatar-grid');grid.replaceChildren();
 AVATAR_IDS.slice(avatarPage*12,avatarPage*12+12).forEach(id=>{
  const button=document.createElement('button');button.type='button';button.className='avatar-choice';button.setAttribute('aria-label',`Elegir avatar ${AVATAR_IDS.indexOf(id)+1}`);button.setAttribute('aria-pressed',String(id===selectedAvatar));
  const image=document.createElement('img');image.src=avatarAssetPath(id);image.alt=`Avatar ${AVATAR_IDS.indexOf(id)+1}`;image.decoding='async';image.draggable=false;button.append(image);
  button.addEventListener('click',()=>{selectedAvatar=id;document.querySelector('#profile-error').textContent='';renderAvatars();updateProfileContinue();});grid.append(button);
 });
 const pages=document.querySelector('#avatar-pages');pages.replaceChildren();
 for(let page=0;page<Math.ceil(AVATAR_IDS.length/12);page++){
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Página ${page+1} de avatares`);button.setAttribute('aria-current',String(page===avatarPage));button.addEventListener('click',()=>{avatarPage=page;renderAvatars();});pages.append(button);
 }
}
const aliasInput=document.querySelector('#alias'),aliasStatus=document.querySelector('#alias-status');
let aliasCheckVersion=0,aliasCheckTimer=null,aliasAvailable=false,checkedAlias='',savingProfile=false;
function updateProfileContinue(){document.querySelector('#profile-continue').disabled=savingProfile||!aliasAvailable||checkedAlias!==aliasInput.value.trim().normalize('NFC')||!selectedAvatar;}
function setAliasStatus(state,message){aliasStatus.dataset.state=state;aliasStatus.textContent=state==='available'?'✓':state==='checking'?'…':state==='empty'?'':'✕';aliasStatus.setAttribute('aria-label',message);aliasStatus.title=message;aliasInput.setAttribute('aria-invalid',String(state==='unavailable'||state==='invalid'));}
function scheduleAliasCheck(){
 clearTimeout(aliasCheckTimer);const version=++aliasCheckVersion;const alias=aliasInput.value.trim().normalize('NFC');aliasAvailable=false;checkedAlias='';updateProfileContinue();
 const error=validateAlias(alias);
 if(error){setAliasStatus(alias?'invalid':'empty',alias?error:'Escribe un alias');return;}
 setAliasStatus('checking','Comprobando disponibilidad…');
 aliasCheckTimer=setTimeout(async()=>{
  try{
   const session=await sessionInitialization;if(!session)throw new Error('No hay conexión.');
   const available=await repository.aliasAvailable(alias);
   if(version!==aliasCheckVersion)return;
   aliasAvailable=available===true;checkedAlias=alias;
   setAliasStatus(aliasAvailable?'available':'unavailable',aliasAvailable?'Alias disponible':'Este alias ya está ocupado');
   document.querySelector('#profile-error').textContent=aliasAvailable?'':'Este alias ya está ocupado. Elige otro.';
  }catch{
   if(version!==aliasCheckVersion)return;
   aliasAvailable=false;setAliasStatus('error','No se pudo comprobar el alias');document.querySelector('#profile-error').textContent='No se pudo comprobar el alias. Revisa la conexión e inténtalo de nuevo.';
  }
  updateProfileContinue();
 },400);
}
aliasInput.addEventListener('input',()=>{document.querySelector('#profile-error').textContent='';scheduleAliasCheck();});
document.querySelector('#random-alias').addEventListener('click',()=>{aliasInput.value=suggestAlias();document.querySelector('#profile-error').textContent='';scheduleAliasCheck();});
document.querySelector('#profile-form').addEventListener('submit',async event=>{
 event.preventDefault();if(savingProfile)return;
 const alias=aliasInput.value.trim().normalize('NFC');
 const error=validateAlias(alias)||(!selectedAvatar?'Elige un avatar para continuar.':'');
 if(error){document.querySelector('#profile-error').textContent=error;return;}
 if(!aliasAvailable||checkedAlias!==alias){scheduleAliasCheck();return;}
 savingProfile=true;updateProfileContinue();
 try{
  const session=window.quizSession||await initializeSession();if(!session)throw new Error('No se pudo conectar.');
  const candidate={alias,avatar:selectedAvatar};await repository.saveProfile(candidate);
  profile=saveProfile(localStorage,alias,selectedAvatar);drawWalletProfile();location.hash='home';
 }catch(error){
  if(error.message?.includes('alias_unavailable')||error.message?.includes('duplicate key')){aliasAvailable=false;setAliasStatus('unavailable','Este alias ya está ocupado');document.querySelector('#profile-error').textContent='Este alias acaba de ser elegido. Prueba con otro.';}
  else document.querySelector('#profile-error').textContent='No se pudo guardar tu perfil. Inténtalo de nuevo.';
 }finally{savingProfile=false;updateProfileContinue();}
});

let lastHomeScroll=0,disposeDuel=null;
function navigate(){
  if(disposeDuel){disposeDuel();disposeDuel=null;}
  if(location.hash!=='#daily')stopDailyTimer();
  let key=location.hash.slice(1)||'home';
  if(profile&&key==='setup'){key='home';history.replaceState(null,'','#home');}
  if(!profile&&key!=='setup'){key='setup';history.replaceState(null,'','#setup');}
  const section=sections[key];
  document.querySelector('#section-page').classList.toggle('duel-page',key==='duel');
  document.querySelector('#section-page').classList.toggle('profile-page',key==='profile');
  document.querySelector('#section-page').classList.toggle('ranking-page',key==='ranking');
  document.querySelector('#section-page').classList.toggle('daily-page',key==='daily');
  document.querySelector('#section-page').classList.toggle('store-page',key==='shop');
  document.querySelector('#section-page').classList.toggle('bloopers-page',key==='bloopers');
  const setup=document.querySelector('#setup');
  if(key==='setup'){
    setup.hidden=false;document.querySelector('#home').hidden=true;document.querySelector('#section-page').hidden=true;document.body.classList.add('setup-open');
    if(!setupOpen){document.querySelector('#alias').value=profile?.alias||'';selectedAvatar=profile?.avatar||null;avatarPage=selectedAvatar?Math.floor(AVATAR_IDS.indexOf(selectedAvatar)/12):0;document.querySelector('#profile-error').textContent='';renderAvatars();scheduleAliasCheck();window.scrollTo(0,0);}
    setupOpen=true;document.title='Crea tu perfil · Quiz LQSA';return;
  }
  setupOpen=false;setup.hidden=true;document.body.classList.remove('setup-open');
  const home=document.querySelector('#home'),page=document.querySelector('#section-page');
  if(!section){home.hidden=false;page.hidden=true;document.title='Quiz LQSA';window.scrollTo(0,lastHomeScroll);return;}
  if(!home.hidden)lastHomeScroll=window.scrollY;
  home.hidden=true;page.hidden=false;
  document.querySelector('#section-title').textContent=section.title;
  document.querySelector('#section-icon').textContent=section.icon;
  document.querySelector('#section-icon').hidden=!section.icon;
  document.querySelector('#section-copy').textContent=section.copy;
  document.querySelector('#section-copy').hidden=!section.copy;
  const content=document.querySelector('#section-content');content.replaceChildren();
  if(key==='profile')drawProfile();
  else if(key==='daily')buildDaily();
  else if(key==='ranking')renderRanking();
  else if(key==='shop')buildShop(content);
  else if(key==='bloopers')buildBloopers(content);
  else if(key==='duel')disposeDuel=mountDuel(content,{rpc:async(name,args)=>{const session=await sessionInitialization;if(!session)throw new Error('No hay conexión con Supabase.');return supabase.rpc(name,args,session);},userId:()=>window.quizSession?.user?.id,onRewards:refresh});
  else{const card=document.createElement('div');card.className='section-card';const text=document.createElement('p');text.textContent=section.notice;card.append(text);content.append(card);}
  document.title=`${section.title} · Quiz LQSA`;window.scrollTo(0,0);document.querySelector('#section-title').focus({preventScroll:true});
}
async function refresh(){try{stats=await repository.fetchStats();drawStats();}catch{ /* Preserve the last confirmed balance on a transient failure. */ }}
async function buildShop(container){
 const session=await sessionInitialization;if(location.hash!=='#shop')return;
 if(!session){container.replaceChildren();const card=document.createElement('section');card.className='daily-result';const title=document.createElement('h2');title.textContent='Tienda no disponible';const copy=document.createElement('p');copy.textContent=sessionError||'Conéctate a internet para consultar tu saldo y tus compras.';const retry=document.createElement('button');retry.type='button';retry.className='daily-next';retry.textContent='REINTENTAR';retry.addEventListener('click',()=>{initializeSession();buildShop(container);});card.append(title,copy,retry);container.append(card);return;}
 await mountStore(container,{getOwned:()=>repository.fetchStoreOwned(),buyItem:itemId=>repository.buyStoreItem(itemId),balance:()=>stats.coins,onPurchased:async()=>{stats=await repository.fetchStats();drawStats();},openVideo:()=>{location.hash='bloopers';}});
}
async function buildBloopers(container){
 const session=await sessionInitialization;if(location.hash!=='#bloopers')return;
 const showMessage=(title,copy)=>{container.replaceChildren();const card=document.createElement('section');card.className='daily-result';const heading=document.createElement('h2');heading.textContent=title;const message=document.createElement('p');message.textContent=copy;const back=document.createElement('a');back.href='#shop';back.className='daily-next';back.textContent='VOLVER A LA TIENDA';card.append(heading,message,back);container.append(card);};
 if(!session){showMessage('Vídeo no disponible',sessionError||'Conéctate para comprobar tu acceso.');return;}
 try{const owned=await repository.fetchStoreOwned();if(!owned.includes('video-bloopers')){showMessage('Vídeo bloqueado','Canjea el vídeo en la tienda para verlo.');return;}mountBloopers(container);}
 catch(error){showMessage('No se pudo comprobar el acceso',error.message||'Comprueba tu conexión y vuelve a intentarlo.');}
}
window.addEventListener('hashchange',navigate);
window.addEventListener('quiz-session-changed',async()=>{if(profile)try{await repository.saveProfile(profile);}catch{}await refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden&&window.QUIZ_SUPABASE?.url)refresh();},30000);
navigate();drawStats();refresh();
