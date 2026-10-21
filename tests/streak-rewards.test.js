import test from 'node:test';
import assert from 'node:assert/strict';
import {streakDay,streakCoins,pendingKey} from '../web/streak-rewards.js';
import {StatsRepository} from '../web/stats.js';
test('ciclos y premios coinciden con KATSEYE',()=>{
 assert.equal(streakDay(0),0);assert.equal(streakDay(5),5);assert.equal(streakDay(30),30);assert.equal(streakDay(31),1);assert.equal(streakDay(60),30);
 assert.equal(streakCoins(5),600);assert.equal(streakCoins(10),800);assert.equal(streakCoins(30),1600);assert.throws(()=>streakCoins(6));
 assert.notEqual(pendingKey('u','cycle1',5),pendingKey('u','cycle2',5));assert.notEqual(pendingKey('u','c',5),pendingKey('v','c',5));
});
test('el canje envía el ciclo y objetivo autenticados, nunca un saldo elegido',async()=>{
 const session={user:{id:'u'},access_token:'token'};let call;
 const repo=new StatsRepository({},()=>session,{rpc:async(...args)=>{call=args;return {status:'claimed',reward:600};}});
 assert.deepEqual(await repo.claimStreak(5,'cycle'),{status:'claimed',reward:600});
 assert.deepEqual(call,['quiz_lqsa_claim_streak',{p_milestone:5,p_cycle:'cycle'},session]);
});
