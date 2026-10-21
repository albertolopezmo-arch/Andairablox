// Explicit editorial groups: distractors must match the kind of answer.
const maleCharacters=['Antonio Recio','Amador Rivas','Javi Maroto','Enrique Pastor','Coque Calatrava','Leo Romaní','Vicente Maroto','Fermín Trujillo','Teodoro Rivas','Bruno Quiroga','Agustín Gordillo','Sergio Arias','Josito','Fran','Fran Pastor','Dylan','Minguito','Maxi','Don Simón','el moroso','Álvaro'];
const femaleCharacters=['Berta Escobar','Maite Figueroa','Lola Reynolds','Araceli Madariaga','Raquel Villanueva','Nines Chacón','Goya Gutiérrez','Izaskun Sagastume','Mari Tere Valverde','Estela Reynolds','Judith Becker','Alba Recio','Menchu Carrascosa','Yoli','Rebeca Ortiz','La Chusa','Violeta Recio','Fina Palomares','Justi','Blanca','Reyes','Carlota Rivas','Josefina','María Jesús','Yolanda','Victoria Rafaela','Noelia','Miranda','Antonia Calendaria','Antonia Candelaria','Úrsula','Julia','Noelia Balmaseda','Patricia'];
const actresses=['Nathalie Seseña','Eva Isanta','Macarena Gómez','Isabel Ordaz','Vanesa Romero','Cristina Medina','Beatriz Carvajal','Mariví Bilbao','Gemma Cuervo','Antonia San Juan','Cristina Castaño','Loles León','Miren Ibarguren','María Adánez','Paz Padilla','Silvia Abril','Petra Martínez','Amparo Valle','Mónica Pérez','Mamen García','Emma Penella'];
const actors=['Jordi Sánchez','Pablo Chiapella','Antonio Pagudo','José Luis Gil','Nacho Guerreros','Luis Miguel Seguí','Ricardo Arroyo','Fernando Tejero','Víctor Palmero','Ernesto Sevilla','Luis Merlo','Carlos Areces','Adrià Collado','Max Marieges','Eduardo Gómez'];
const children=['Josito','Fran','Dylan'];
const fathers=['Vicente Maroto','Enrique Pastor','Antonio Recio','Fermín Trujillo','Amador Rivas'];
const mothers=['Goya Gutiérrez','Berta Escobar','Menchu Carrascosa','Estela Reynolds','Justi','Maite Figueroa','Judith Becker'];
export function plausibleDistractors(prompt,answer,type,pool){
 let candidates=[...new Set(pool)];
 if(['cast','actor'].includes(type)){
  candidates=actresses.includes(answer)?actresses:actors.includes(answer)?actors:candidates;
 }else if(['person','character','name'].includes(type)){
  const male=maleCharacters.includes(answer),female=femaleCharacters.includes(answer);
  if(/(?:el padre|es padre)/i.test(prompt)&&male)candidates=fathers;
  else if(/(?:la madre|es madre)/i.test(prompt)&&female)candidates=mothers;
  else if(/(?:hermano|hijo|nieto)/i.test(prompt)&&children.includes(answer))candidates=children;
  else if(male)candidates=type==='name'?children:maleCharacters.filter(v=>!['Álvaro','Don Simón','el moroso'].includes(v));
  else if(female)candidates=type==='name'?['Josefina','Yolanda','María Jesús','Victoria Rafaela','Noelia','Miranda']:femaleCharacters.filter(v=>v.includes(' ')||['Yoli','Justi','Blanca','Reyes'].includes(v));
 }
 return [...new Set(candidates)].filter(value=>value!==answer);
}
