import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {AVATAR_IDS,avatarAssetPath,loadProfile,saveProfile,validateAlias,PROFILE_KEY} from '../web/profile.js';
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
test('alias and selected avatar are required',()=>{
 const db=storage();assert.throws(()=>saveProfile(db,'ab','avatar-1'));assert.throws(()=>saveProfile(db,'Vecino',null));assert.throws(()=>saveProfile(db,'<script>','avatar-1'));assert.equal(loadProfile(db),null);
});
test('all 28 avatars are supported and profile survives reload',()=>{
 const db=storage();assert.equal(AVATAR_IDS.length%4,0);for(const avatar of AVATAR_IDS){const saved=saveProfile(db,'  Vecino Málaga  ',avatar);assert.deepEqual(loadProfile(db),saved);assert.equal(saved.alias,'Vecino Málaga');}
});
test('all selectable avatars have a bundled image asset',()=>{
 for(const avatar of AVATAR_IDS)assert.ok(existsSync(fileURLToPath(new URL(`../web/${avatarAssetPath(avatar)}`,import.meta.url))),`${avatar} image is missing`);
});
test('invalid stored profile does not bypass setup',()=>{
 const db=storage();db.setItem(PROFILE_KEY,'broken');assert.equal(loadProfile(db),null);db.setItem(PROFILE_KEY,JSON.stringify({version:1,alias:'Vecino',avatar:'foreign'}));assert.equal(loadProfile(db),null);
});
