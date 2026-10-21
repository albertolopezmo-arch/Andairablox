import test from 'node:test';
import assert from 'node:assert/strict';
import {plausibleDistractors} from '../web/answer-options.js';
import {characterRound} from '../web/duel-questions.js';
import {DAILY_QUESTIONS} from '../web/daily-questions.js';
test('padre de Javier y hermano de Yoli tienen distractores masculinos coherentes',()=>{
 for(let i=0;i<100;i++){
  const father=characterRound('avatar-6').find(q=>q.prompt.includes('padre de Javi'));
  assert.ok(father.options.every(v=>['Vicente Maroto','Enrique Pastor','Antonio Recio','Fermín Trujillo','Amador Rivas'].includes(v)));
  const brother=characterRound('avatar-17').find(q=>q.prompt.includes('hermano de Yoli'));
  assert.deepEqual(new Set(brother.options),new Set(['Josito','Fran','Dylan']));
 }
});
test('las preguntas de actrices ofrecen actrices y Lola aparece como Reynolds',()=>{
 assert.ok(plausibleDistractors('¿Quién interpreta a Lola?','Macarena Gómez','actor',[]).includes('Eva Isanta'));
 assert.ok(!plausibleDistractors('¿Quién interpreta a Lola?','Macarena Gómez','actor',[]).includes('Antonio Pagudo'));
 assert.ok(!JSON.stringify(DAILY_QUESTIONS).includes('Lola Trujillo'));
 assert.ok(!JSON.stringify(DAILY_QUESTIONS).includes('madre de Alba?","answer":"Menchu'));
});
