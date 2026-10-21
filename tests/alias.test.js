import test from 'node:test';
import assert from 'node:assert/strict';
import {StatsRepository} from '../web/stats.js';
test('la disponibilidad se comprueba en servidor con la sesión del usuario',async()=>{
 const session={user:{id:'u'},access_token:'token'};let args;
 const repository=new StatsRepository({},()=>session,{rpc:async(...values)=>{args=values;return false;}});
 assert.equal(await repository.aliasAvailable('Vecino'),false);
 assert.deepEqual(args,['quiz_lqsa_alias_available',{p_alias:'Vecino'},session]);
});
