import test from 'node:test';import assert from 'node:assert/strict';
import {DUEL_CHARACTERS,chooseWheel,characterRound} from '../web/duel-questions.js';
test('la ruleta tiene ocho personajes únicos y cambia al volver a entrar',()=>{
 const a=chooseWheel(()=>.1),b=chooseWheel(()=>.1,a);assert.equal(new Set(a).size,8);assert.notDeepEqual(new Set(a),new Set(b));
});
test('los 28 personajes tienen cinco preguntas propias con tres opciones y respuesta inequívoca',()=>{
 assert.equal(DUEL_CHARACTERS.length,28);const ids=new Set();
 for(const c of DUEL_CHARACTERS){const round=characterRound(c.id);assert.equal(round.length,5);assert.equal(new Set(round.map(q=>q.prompt)).size,5);
 for(const q of round){assert.equal(ids.has(q.id),false);ids.add(q.id);assert.equal(q.options.length,3);assert.equal(new Set(q.options).size,3);assert.equal(q.options[q.correctIndex],q.answer);}}
});
