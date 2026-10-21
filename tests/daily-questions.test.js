import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_QUESTIONS, createDailyRound } from '../web/daily-questions.js';

test('el banco tiene al menos 150 preguntas distintas', () => {
  assert.ok(DAILY_QUESTIONS.length >= 150);
  assert.equal(new Set(DAILY_QUESTIONS.map(question => question.id)).size, DAILY_QUESTIONS.length);
  assert.equal(new Set(DAILY_QUESTIONS.map(question => question.prompt.toLocaleLowerCase('es'))).size, DAILY_QUESTIONS.length);
});

test('hay preguntas de cada temporada, de la 1 a la 16', () => {
  const prompts = DAILY_QUESTIONS.map(question => question.prompt.toLocaleLowerCase('es')).join('\n');
  for (let season = 1; season <= 16; season++) {
    assert.match(prompts, new RegExp(`temporada ${season}(?:\\D|$)`), `falta la temporada ${season}`);
  }
});

test('cada pregunta tiene tres opciones diferentes y una respuesta correcta', () => {
  const round = createDailyRound(() => 0.37, [], DAILY_QUESTIONS.length);
  assert.equal(round.questions.length, DAILY_QUESTIONS.length);
  for (const question of round.questions) {
    assert.equal(question.options.length, 3);
    assert.equal(new Set(question.options).size, 3);
    assert.equal(question.options[question.correctIndex], question.answer);
  }
});

test('una ronda no repite preguntas y mezcla la posición de la respuesta', () => {
  const indexes = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    let state = seed;
    const random = () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646; };
    const round = createDailyRound(random, [], 10);
    assert.equal(round.questions.length, 10);
    assert.equal(new Set(round.questions.map(item => item.id)).size, 10);
    round.questions.forEach(question => indexes.add(question.correctIndex));
  }
  assert.deepEqual([...indexes].sort(), [0, 1, 2]);
});

test('la ronda evita preguntas ya vistas y reinicia el historial cuando se agota', () => {
  const allButTen = DAILY_QUESTIONS.slice(0, -10).map(question => question.id);
  const round = createDailyRound(() => 0.41, allButTen, 10);
  assert.equal(round.resetHistory, false);
  assert.equal(round.questions.length, 10);
  assert.ok(round.questions.every(question => !allButTen.includes(question.id)));

  const exhausted = createDailyRound(() => 0.41, DAILY_QUESTIONS.map(question => question.id), 10);
  assert.equal(exhausted.resetHistory, true);
  assert.equal(exhausted.questions.length, 10);
});

test('no repite el mismo dato con otra redacción y respeta el historial anterior',()=>{
 assert.equal(new Set(DAILY_QUESTIONS.map(q=>q.topic)).size,DAILY_QUESTIONS.length);
 for(let seed=1;seed<=100;seed++){
  const round=createDailyRound(()=>seed/101,[],10);
  assert.equal(new Set(round.questions.map(q=>q.topic)).size,10);
 }
});
