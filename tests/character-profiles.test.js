import test from 'node:test';import assert from 'node:assert/strict';
import {CHARACTER_PROFILES} from '../web/character-profiles.js';
import {AVATAR_IDS} from '../web/profile.js';
test('cada avatar confirmado tiene ficha de personaje, curiosidad y cita',()=>{
 assert.equal(Object.keys(CHARACTER_PROFILES).length,28);
 for(const id of AVATAR_IDS){const value=CHARACTER_PROFILES[id];assert.ok(value.name&&value.curiosity&&value.quote);}
 assert.equal(CHARACTER_PROFILES['avatar-1'].name,'Fermín');assert.equal(CHARACTER_PROFILES['avatar-28'].name,'Alba');
});
