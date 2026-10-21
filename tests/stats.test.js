import test from 'node:test';
import assert from 'node:assert/strict';
import {StatsRepository} from '../web/stats.js';
test('without Supabase the counters stay zero and no network call occurs',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected network')};
 try{assert.deepEqual(await new StatsRepository().fetchStats(),{points:0,coins:0,dailyCompletedDate:null,dailyLastScore:0,streakDays:0,rewardCycle:null,claimedMilestones:[]});}finally{globalThis.fetch=original;}
});
test('authenticated balances are read for the current user only',async()=>{
 const original=globalThis.fetch;let call;
 globalThis.fetch=async(url,options)=>{if(url.pathname.includes('streak_rewards'))return {ok:true,json:async()=>[{milestone:5}]};call={url,options};return {ok:true,json:async()=>[{points:75,coins:450,streak_days:7,reward_cycle:'cycle-1'}]};};
 try{
 const repo=new StatsRepository({url:'https://example.supabase.co',publicKey:'public'},()=>({access_token:'test',user:{id:'user-123'}}));
 assert.deepEqual(await repo.fetchStats(),{points:75,coins:450,dailyCompletedDate:null,dailyLastScore:0,streakDays:7,rewardCycle:'cycle-1',claimedMilestones:[5]});
 assert.equal(call.url.searchParams.get('user_id'),'eq.user-123');assert.equal(call.options.headers.Authorization,'Bearer test');
 }finally{globalThis.fetch=original;}
});

test('Daily acredita puntos por RPC autenticada y puede cargar los veinte primeros',async()=>{
 const calls=[];const client={rpc:async(name,args,session)=>{calls.push({name,args,session});return name==='quiz_lqsa_submit_daily'?[{points_awarded:70,total_points:170,completed_date:'2026-10-16'}]:[{position:1,alias:'Vecino',avatar_id:'avatar-1',points:170,streak_days:3}];}};
 const session={access_token:'token',user:{id:'user-1'}};const repo=new StatsRepository({},()=>session,client);
 assert.deepEqual(await repo.submitDaily([15000,10000,5000,1000,2000,3000,4000]),{points_awarded:70,total_points:170,completed_date:'2026-10-16'});
 assert.deepEqual(await repo.fetchTopPlayers(),[{position:1,alias:'Vecino',avatar_id:'avatar-1',points:170,streak_days:3}]);
 assert.deepEqual(calls.map(call=>call.name),['quiz_lqsa_submit_daily','quiz_lqsa_top_players']);
 assert.deepEqual(calls[0].args,{p_correct_remaining_ms:[15000,10000,5000,1000,2000,3000,4000]});assert.equal(calls[0].session,session);
});

test('Daily mantiene el saldo si faltan las recompensas de racha',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>url.pathname.includes('streak_rewards')?{ok:false,status:404}:{ok:true,json:async()=>[{points:123,coins:456,daily_completed_date:'2026-10-16',daily_last_score:8}]};
 try{
 const repo=new StatsRepository({url:'https://example.supabase.co',publicKey:'public'},()=>({access_token:'test',user:{id:'user-123'}}));
 const stats=await repo.fetchStats();
 assert.equal(stats.points,123);assert.equal(stats.coins,456);
 assert.equal(stats.dailyCompletedDate,'2026-10-16');assert.equal(stats.dailyLastScore,8);
 assert.equal(stats.rewardsUnavailable,true);assert.deepEqual(stats.claimedMilestones,[]);
 }finally{globalThis.fetch=original;}
});

test('un error del saldo bloquea Daily en vez de inventar una cuenta a cero',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({message:'expired'})});
 try{
 const repo=new StatsRepository({url:'https://example.supabase.co',publicKey:'public'},()=>({access_token:'expired',user:{id:'user-123'}}));
 await assert.rejects(repo.fetchStats(),/sesión ha caducado/);
 }finally{globalThis.fetch=original;}
});

test('la compra de tienda se envía al RPC autenticado y no modifica el saldo desde cliente',async()=>{
 const session={access_token:'token',user:{id:'u'}};let call;
 const repo=new StatsRepository({},()=>session,{rpc:async(name,args,actualSession)=>{call={name,args,actualSession};return {status:'purchased',coins:60};}});
 assert.deepEqual(await repo.buyStoreItem('wallpaper-night'),{status:'purchased',coins:60});
 assert.deepEqual(call,{name:'quiz_lqsa_buy_store_item',args:{p_item_id:'wallpaper-night'},actualSession:session});
});

test('la tienda muestra mensajes claros si falta SQL o saldo',async()=>{
 const session={access_token:'token',user:{id:'u'}};
 const repo=new StatsRepository({},()=>session,{rpc:async()=>{throw new Error('insufficient_coins');}});
 await assert.rejects(repo.buyStoreItem('stickers-portal'),/monedas suficientes/);
 const missing=new StatsRepository({},()=>session,{rpc:async()=>{throw new Error('function quiz_lqsa_buy_store_item not found in schema cache');}});
 await assert.rejects(missing.buyStoreItem('wallpaper-night'),/Tienda todavía no está activada/);
});
