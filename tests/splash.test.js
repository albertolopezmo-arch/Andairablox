import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('splash dura seis segundos, libera la app y avisa al banner al terminar',()=>{
 let delay,finish,removed=false,enabled=false;const messages=[];
 const elements={'#app-splash':{remove:()=>removed=true},'#splash-art':{complete:true},'#splash-progress':{setAttribute(){}},'#splash-fill':{style:{}},'.app-shell':{removeAttribute:name=>{enabled=name==='inert';}}};
 const context={document:{querySelector:k=>elements[k],body:{classList:{remove(){}}}},performance:{now:()=>0},setInterval:()=>1,clearInterval(){},setTimeout:(fn,ms)=>{finish=fn;delay=ms;},window:{QuizRewardAds:{postMessage:m=>messages.push(JSON.parse(m))}}};
 vm.runInNewContext(fs.readFileSync('web/splash.js','utf8'),context);
 assert.equal(delay,6000);assert.equal(removed,false);assert.equal(messages.length,0);
 finish();assert.ok(removed&&enabled);assert.equal(messages[0].action,'splash-finished');
});
