import {watchRewardedVideo,showInterstitial} from './streak-rewards.js';
import {DUEL_CHARACTERS,chooseWheel,characterRound} from './duel-questions.js';
import {avatarAssetPath} from './profile.js';
import {dailyReward} from './daily-scoring.js';
export function botAttempt(random=Math.random){return {delay:3000+Math.floor(random()*14000),correct:random()<.65};}
export function duelWinner(mine,theirs){return mine===theirs?'¡Empate!':mine>theirs?'¡Has ganado!':'Esta vez gana tu rival';}
export function mountDuel(container,{rpc,now=()=>performance.now(),practiceOnly=false,watchVideo=watchRewardedVideo,showAd=showInterstitial,storage=globalThis.localStorage,userId=()=>'local',onRewards=()=>{}}){
 const shownInterstitials=new Set();
 let generation=0,disposed=false,mode='menu',duelId=null,poll=null,tick=null,waitingSince=0,posting=false,deadline=0,timerNode=null,signature='',latest=null,bot=null,queueAttempted=false,wheelIds=chooseWheel();
 function clear(){clearTimeout(poll);clearInterval(tick);poll=null;tick=null;}
 function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
 function button(text,action){const b=node('button',text,'daily-next');b.type='button';b.addEventListener('click',action);return b;}
 function panel(title,copy){container.replaceChildren();const card=node('section',undefined,'section-card duel-card');card.append(node('h2',title));if(copy)card.append(node('p',copy));container.append(card);return card;}
 function wheel(card,ids,selected=null){
  const holder=node('div',undefined,'duel-wheel');const pointer=node('span','▼','duel-wheel-pointer');pointer.setAttribute('aria-hidden','true');
  const rotor=node('div',undefined,'duel-wheel-rotor');
  ids.forEach((id,i)=>{const character=DUEL_CHARACTERS.find(c=>c.id===id);const cell=node('div',undefined,'duel-wheel-avatar');const angle=i*Math.PI/4;cell.style.left=`${50+35*Math.sin(angle)}%`;cell.style.top=`${50-35*Math.cos(angle)}%`;const image=node('img');image.src=avatarAssetPath(id);image.alt=character?.name||id;image.draggable=false;cell.append(image);rotor.append(cell);});
  const center=node('div','LQSA','duel-wheel-center');rotor.append(center);holder.append(pointer,rotor);card.append(holder);
  if(selected){const index=ids.indexOf(selected);const name=DUEL_CHARACTERS.find(c=>c.id===selected)?.name||'Personaje';
   const label=node('p','Girando la ruleta…','duel-topic');label.setAttribute('aria-live','polite');card.append(label);
   setTimeout(()=>{rotor.style.transform=`rotate(${1800-index*45}deg)`;},30);
   setTimeout(()=>{if(label.isConnected!==false)label.textContent=`¡Ha salido ${name}! 5 preguntas sobre este personaje.`;},3600);
  }
 }
 function menu(message=''){
  clear();mode='menu';duelId=null;signature='';wheelIds=chooseWheel(Math.random,wheelIds);const card=panel('¿CON QUIÉN JUEGAS?','5 preguntas · 20 segundos por pregunta. Gana quien sume más puntos con aciertos y rapidez.');
  wheel(card,wheelIds);card.append(node('p','8 personajes al azar. La ruleta elegirá el tema de las 5 preguntas.','duel-note'));
  card.append(button('BUSCAR OTRO JUGADOR',search),button('JUGAR CONTRA LA MÁQUINA',startBot));
  if(practiceOnly)card.append(node('p','Vista de prueba sin premios.','duel-note'));
  if(message)card.append(node('p',message,'duel-message'));
 }
 async function search(){
  const token=++generation;clear();mode='searching';queueAttempted=true;waitingSince=now();panel('BUSCANDO RIVAL…','Esperando a otro vecino que entre al Duelo.');
  try{const state=await rpc('quiz_lqsa_join_duel',{});if(disposed||token!==generation){if(state.state==='waiting')rpc('quiz_lqsa_cancel_duel',{p_duel:state.id}).catch(()=>{});return;}duelId=state.id;accept(state);schedule(token);}
  catch{if(!disposed&&token===generation)menu('No se pudo buscar rival. Comprueba la conexión y que estén cargados los SQL del Duelo.');}
 }
 function schedule(token){clearTimeout(poll);if(disposed||token!==generation||!duelId||mode==='finished')return;poll=setTimeout(async()=>{
  try{const state=await rpc('quiz_lqsa_duel_state',{p_duel:duelId});if(disposed||token!==generation)return;accept(state);}
  catch{if(!disposed&&token===generation){const status=container.querySelector('.duel-network');if(status)status.textContent='Reconectando… El reloj de la partida sigue avanzando.';}}
  if(!disposed&&token===generation)schedule(token);
 },1000);}
 async function stopSearch(useBot){
  if(posting||!duelId)return;posting=true;
  try{const state=await rpc('quiz_lqsa_cancel_duel',{p_duel:duelId});if(disposed)return;
   if(state.state==='playing'||state.state==='finished'){accept(state);return;}
   ++generation;clear();duelId=null;queueAttempted=false;useBot?startBot():menu();
  }catch{const status=container.querySelector('.duel-network');if(status)status.textContent='No se pudo cancelar la búsqueda. Inténtalo de nuevo.';}
  finally{posting=false;}
 }
 function accept(state){
  latest=state;
  if(state.state==='waiting'){
   mode='searching';const elapsed=now()-waitingSince;const card=panel('BUSCANDO RIVAL…',elapsed>=25000?'Aún no hay otro vecino disponible. Puedes seguir esperando o jugar contra la máquina.':'Esperando a otro vecino que entre al Duelo.');
   card.append(node('p','No se creará un rival ficticio.','duel-note'),node('p','','duel-network'));
   if(elapsed>=25000)card.append(button('JUGAR CONTRA LA MÁQUINA',()=>stopSearch(true)));
   card.append(button('CANCELAR BÚSQUEDA',()=>stopSearch(false)));return;
  }
  if(state.state==='cancelled'){queueAttempted=false;menu('La búsqueda ha terminado. Puedes volver a buscar o jugar contra la máquina.');return;}
  mode='online';
  if(state.state==='finished'){finish(state.my_score,state.opponent_score,state.opponent?.alias||'Rival',false,state.reward);return;}
  if(!state.question){if(signature!==`wheel-${state.id}`){signature=`wheel-${state.id}`;const card=panel(state.is_bot?'RULETA CONTRA LA MÁQUINA':'¡RIVAL ENCONTRADO!',state.is_bot?'El personaje elegido será el tema de las cinco preguntas.':`Juegas contra ${state.opponent?.alias||'otro vecino'}. Misma ruleta y mismas preguntas para los dos.`);wheel(card,state.wheel||wheelIds,state.character_avatar);card.append(node('p','','duel-network'));}return;}
  deadline=now()+Number(state.remaining_ms||0);
  const sig=JSON.stringify([state.index,state.answer,state.correct_index,state.my_score,state.opponent_score,posting]);
  if(sig!==signature){signature=sig;renderQuestion(state.question,state.index,state.my_score,state.opponent_score,state.opponent?.alias||'Rival',state.answer,state.correct_index,answerOnline);}
  updateClock();if(!tick)tick=setInterval(updateClock,100);
 }
 function updateClock(){if(!timerNode)return;const left=Math.max(0,Math.ceil((deadline-now())/1000));timerNode.textContent=`${left}s`;if(!left)for(const b of container.querySelectorAll('.daily-answer'))b.disabled=true;}
 function renderQuestion(question,index,mine,theirs,opponent,answer,correct,onAnswer){
  const card=panel(`PREGUNTA ${index+1} DE 5`);card.append(node('p',`Tú ${mine} · ${opponent} ${theirs}`,'duel-score'));
  timerNode=node('strong','','duel-clock');timerNode.setAttribute('role','timer');card.append(timerNode,node('h3',question.prompt,'daily-question'));
  const answers=node('div',undefined,'daily-answers');question.options.forEach((option,i)=>{const b=node('button',option,'daily-answer');b.type='button';b.disabled=Boolean(answer)||posting||(deadline<=now());if(correct===i)b.classList.add('is-correct');if(answer?.option===i&&correct!==i)b.classList.add('is-wrong');b.addEventListener('click',()=>onAnswer(i));answers.append(b);});card.append(answers);
  if(answer)card.append(node('p',answer.points>0?`¡Correcto! +${answer.points} puntos`:'Esta respuesta no suma puntos.','daily-feedback'));
  else if(correct!==undefined)card.append(node('p','Se acabó el tiempo.','daily-feedback'));
  card.append(node('p','Pasamos a la siguiente cuando ambos respondáis o se agote el tiempo.','duel-note'),node('p','','duel-network'));updateClock();
 }
 async function answerOnline(option){
  if(posting||latest?.answer||deadline<=now())return;posting=true;const token=generation;const index=latest.index;
  for(const b of container.querySelectorAll('.daily-answer'))b.disabled=true;
  try{const state=await rpc('quiz_lqsa_answer_duel',{p_duel:duelId,p_index:index,p_option:option});if(!disposed&&token===generation){posting=false;accept(state);}}
  catch{if(!disposed&&token===generation){signature='';const status=container.querySelector('.duel-network');if(status)status.textContent='No se pudo confirmar la respuesta. Reconectando…';}}
  finally{posting=false;}
 }
 async function startBot(){
  if(!practiceOnly){
   const token=++generation;clear();panel('PREPARANDO DUELO…','Conectando para guardar tus puntos y monedas.');
   try{const state=await rpc('quiz_lqsa_start_bot_duel',{});if(disposed||token!==generation)return;duelId=state.id;queueAttempted=false;accept(state);schedule(token);}
   catch{if(!disposed&&token===generation)menu('No se pudo iniciar la partida. Revisa la conexión y que estén cargados los SQL del Duelo.');}
   return;
  }
  if(queueAttempted){
   const token=generation;panel('CERRANDO LA BÚSQUEDA…','Comprobando que no se haya unido otro jugador.');
   try{const state=await rpc('quiz_lqsa_leave_duel_queue',{});if(disposed||token!==generation)return;
    if(state?.state==='playing'){duelId=state.id;accept(state);schedule(token);return;}
    queueAttempted=false;
   }catch{if(!disposed&&token===generation)menu('No se pudo cerrar la búsqueda. Comprueba la conexión antes de pasar a la máquina.');return;}
  }
  ++generation;clear();mode='bot';duelId=null;const chosen=wheelIds[Math.floor(Math.random()*wheelIds.length)];
  const card=panel('RULETA CONTRA LA MÁQUINA','El personaje elegido será el tema de las cinco preguntas.');wheel(card,wheelIds,chosen);
  bot={questions:characterRound(chosen),index:0,mine:0,theirs:0,answer:null,attempt:null,answered:false};
  const token=generation;poll=setTimeout(()=>{if(!disposed&&token===generation)beginBotQuestion();},4300);
 }
 function beginBotQuestion(){
  bot.answer=null;bot.attempt=botAttempt();bot.answered=false;bot.revealed=false;deadline=now()+20000;const started=now();
  renderQuestion(bot.questions[bot.index],bot.index,bot.mine,bot.theirs,'Máquina',null,undefined,answerBot);
  clearInterval(tick);tick=setInterval(()=>{
   updateClock();if(!bot.revealed&&now()>=deadline){bot.revealed=true;renderQuestion(bot.questions[bot.index],bot.index,bot.mine,bot.theirs,'Máquina',bot.answer,bot.questions[bot.index].correctIndex,answerBot);}
   if(!bot.answered&&now()-started>=bot.attempt.delay){bot.answered=true;if(bot.attempt.correct)bot.theirs+=dailyReward(20000-bot.attempt.delay).points;const score=container.querySelector('.duel-score');if(score)score.textContent=`Tú ${bot.mine} · Máquina ${bot.theirs}`;}
   if((bot.answer&&bot.answered)||now()>=deadline+2000){clearInterval(tick);tick=null;if(++bot.index>=5)finish(bot.mine,bot.theirs,'Máquina',true);else beginBotQuestion();}
  },100);
 }
 function answerBot(option){
  if(!bot||bot.answer||deadline<=now())return;
  const correct=bot.questions[bot.index].correctIndex;const points=option===correct?dailyReward(Math.max(1,Math.floor(deadline-now()))).points:0;
  bot.mine+=points;bot.answer={option,points};renderQuestion(bot.questions[bot.index],bot.index,bot.mine,bot.theirs,'Máquina',bot.answer,correct,answerBot);
 }
 function finish(mine,theirs,opponent,practice,reward=null){
  clear();mode='finished';queueAttempted=false;timerNode=null;
  if(!practice&&duelId&&!shownInterstitials.has(duelId)){
   shownInterstitials.add(duelId);const token=generation;
   panel(duelWinner(mine,theirs),`Tú: ${mine} puntos · ${opponent}: ${theirs} puntos`);
   Promise.resolve().then(()=>{if(!disposed&&token===generation)return showAd();}).catch(()=>{}).then(()=>{if(!disposed&&token===generation)finish(mine,theirs,opponent,practice,reward);});return;
  }
 const card=panel(duelWinner(mine,theirs),`Tú: ${mine} puntos · ${opponent}: ${theirs} puntos`);
  card.append(node('p',practice?'Vista de prueba, sin premios.':reward?`+${reward.points} puntos al ranking · ${reward.doubled?reward.coins*2:reward.coins} monedas`:'Partida terminada sin respuestas: no hay premio.'));
  if(reward&&!practice){
   Promise.resolve(onRewards()).catch(()=>{});
   if(reward.doubled)card.append(node('p','✓ Monedas duplicadas con el vídeo.','duel-topic'));
   else{
    const key=`quiz-lqsa-duel-video:${userId()}:${duelId}`;
    const status=node('p','','duel-network');
    const double=button(storage?.getItem(key)?'REINTENTAR COBRO X2':`VER VÍDEO · ${reward.coins} → ${reward.coins*2} MONEDAS`,async()=>{
     double.disabled=true;const token=generation;const match=duelId;
     try{
      if(!storage?.getItem(key)){status.textContent='Cargando vídeo de bonificación…';await watchVideo();storage?.setItem(key,'completed');}
      const result=await rpc('quiz_lqsa_double_duel_coins',{p_duel:match});storage?.removeItem(key);
      if(!disposed&&token===generation)finish(mine,theirs,opponent,false,{...reward,doubled:true});
      else Promise.resolve(onRewards()).catch(()=>{});
     }catch(error){if(!disposed&&token===generation){status.textContent=error.message||'No se pudo confirmar el premio. Inténtalo de nuevo.';double.disabled=false;double.textContent=storage?.getItem(key)?'REINTENTAR COBRO X2':'VER VÍDEO Y DUPLICAR MONEDAS';}}
    });card.append(double,status);
   }
  }
  card.append(button('VOLVER A DUELO',()=>{++generation;menu();}));
 }

 menu();
 return ()=>{disposed=true;++generation;clear();if(mode==='searching'&&duelId)rpc('quiz_lqsa_cancel_duel',{p_duel:duelId}).catch(()=>{});};
}
