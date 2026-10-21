import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyReward} from '../web/daily-scoring.js';
test('premios por velocidad y caducidad',()=>{
 assert.deepEqual(dailyReward(20000),{points:50,coins:5});
 assert.deepEqual(dailyReward(15000),{points:40,coins:4});
 assert.deepEqual(dailyReward(10000),{points:30,coins:3});
 assert.deepEqual(dailyReward(5000),{points:20,coins:2});
 assert.deepEqual(dailyReward(1),{points:10,coins:1});
 for(const v of [0,-1,20001,NaN,1.5])assert.deepEqual(dailyReward(v),{points:0,coins:0});
});
