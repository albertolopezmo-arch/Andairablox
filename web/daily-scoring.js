// 20 segundos por pregunta. Solo se llama para respuestas correctas dentro de tiempo.
export function dailyReward(remainingMs) {
 if (!Number.isInteger(remainingMs) || remainingMs <= 0 || remainingMs > 20000) return {points:0,coins:0};
 const seconds=Math.floor(remainingMs/1000);
 return {points:10+seconds*2,coins:1+Math.floor(seconds/5)};
}
