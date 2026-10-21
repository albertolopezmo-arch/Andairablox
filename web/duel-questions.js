import {plausibleDistractors} from './answer-options.js';
// Avatares y nombres asignados por el usuario. Banco específico de Duelo.
const definitions=[
['Fermín','Fernando Tejero',[
 ['¿Quién es la hija de Fermín?','Lola Reynolds','person'],['¿Con qué actriz se casa Fermín?','Estela Reynolds','person'],['¿Qué apellido tiene Fermín?','Trujillo','surname'],['¿Qué especialidad malagueña prepara Fermín?','Espetos','food']]],
['Berta','Nathalie Seseña',[
 ['¿Quién es el marido de Berta?','Antonio Recio','person'],['¿Quién es la hija de Berta?','Alba Recio','person'],['¿Qué apellido tiene Berta?','Escobar','surname'],['¿Qué negocio comparte Berta con Antonio?','Mariscos Recio','business']]],
['Antonio','Jordi Sánchez',[
 ['¿Quién es la esposa de Antonio Recio?','Berta Escobar','person'],['¿Quién es la hija de Antonio?','Alba Recio','person'],['¿Qué vende principalmente Antonio Recio?','Pescado y marisco congelado','product'],['¿Cómo se llama el negocio de Antonio?','Mariscos Recio','business']]],
['Fina','Petra Martínez',[
 ['¿Cuál es el nombre de pila de doña Fina?','Josefina','name'],['¿Cuál es el apellido de Fina?','Palomares','surname'],['¿Qué vecino quiere convertir a Fina en su único amigo?','Vicente Maroto','person'],['¿Qué intenta eludir Fina en la temporada 15?','La justicia','event']]],
['Judith','Cristina Castaño',[
 ['¿Qué profesión ejerce Judith?','Psicóloga','job'],['¿Quién es el padre del hijo de Judith?','Enrique Pastor','person'],['¿Cómo se llama el hijo de Judith?','Dylan','name'],['¿Qué cargo comunitario asume Judith en la quinta temporada?','Presidenta','role']]],
['Javier','Antonio Pagudo',[
 ['¿Quién es el padre de Javi?','Vicente Maroto','person'],['¿Quién es la madre de Javi?','Goya Gutiérrez','person'],['¿Quién fue la esposa de Javi?','Lola Reynolds','person'],['¿Cuál es el apodo de Javi?','El Pelocho','nickname']]],
['Lola','Macarena Gómez',[
 ['¿Quién es el padre de Lola?','Fermín Trujillo','person'],['¿Quién es la madre de Lola?','Estela Reynolds','person'],['¿Quién fue el marido de Lola?','Javi Maroto','person'],['¿A qué ciudad viaja Lola para participar en una telenovela?','Miami','place']]],
['Amador','Pablo Chiapella',[
 ['¿Quién es la madre de Amador?','Justi','person'],['¿Quién es el hermano de Amador?','Teodoro Rivas','person'],['¿Con quién forma Amador la pareja de los Cuquis?','Maite Figueroa','person'],['¿Qué apodo tiene Amador?','El Cuqui','nickname']]],
['Teodoro','Ernesto Sevilla',[
 ['¿Quién es el hermano de Teodoro?','Amador Rivas','person'],['¿Quién es la madre de Teodoro?','Justi','person'],['¿Qué apellido comparte Teodoro con Amador?','Rivas','surname'],['¿Con qué hija de Menchu mantiene una relación Teodoro?','Yoli','person']]],
['Raquel','Vanesa Romero',[
 ['¿Quién es la prima de Raquel?','Nines Chacón','person'],['¿Qué apellido tiene Raquel?','Villanueva','surname'],['¿Cuál era el trabajo de Raquel en la constructora?','Comercial','job'],['¿Qué enamorado de Raquel vive en Villazarcillo?','Minguito','person']]],
['Maite','Eva Isanta',[
 ['¿Qué apodo tiene Maite?','La Cuqui','nickname'],['¿Con quién forma Maite la pareja de los Cuquis?','Amador Rivas','person'],['¿Quién es una de las hijas de Maite?','Carlota Rivas','person'],['¿Cuál es el apellido de Maite?','Figueroa','surname']]],
['Vicente','Ricardo Arroyo',[
 ['¿Quién es el hijo de Vicente?','Javi Maroto','person'],['¿Quién fue la esposa de Vicente?','Goya Gutiérrez','person'],['¿Qué apodo tiene Vicente?','El hombre cojín','nickname'],['¿Qué apellido tiene Vicente?','Maroto','surname']]],
['Enrique','José Luis Gil',[
 ['¿Qué cargo municipal tuvo Enrique?','Concejal de Juventud y Tiempo Libre','job'],['¿Quién fue la esposa de Enrique y madre de Fran?','Araceli Madariaga','person'],['¿Con quién tiene Enrique a Dylan?','Judith Becker','person'],['¿Cómo se llama el hijo de Enrique y Araceli?','Fran','name']]],
['Coque','Nacho Guerreros',[
 ['¿Qué trabajo desempeña Coque en la comunidad?','Conserje-jardinero','job'],['¿Qué apellido tiene Coque?','Calatrava','surname'],['¿Con qué prima de Raquel mantiene una relación Coque?','Nines Chacón','person'],['¿Qué vivienda móvil utiliza Coque?','Caravana','home']]],
['Chusa','Paz Padilla',[
 ['¿Cuál es el nombre de pila de la Chusa?','María Jesús','name'],['¿Qué trabajo doméstico realiza la Chusa?','Limpieza','job'],['¿Qué personaje encarga a la Chusa escribir su novela?','Maite Figueroa','person'],['¿Cómo se conoce habitualmente a María Jesús?','La Chusa','nickname']]],
['Minguito','Max Marieges',[
 ['¿De qué vecina está enamorado Minguito?','Raquel Villanueva','person'],['¿En qué pueblo tiene Minguito su olivar?','Villazarcillo','place'],['¿Qué instala Minguito en su olivar para hacerse millonario?','Generadores eólicos','object'],['¿Qué cultivo tiene Minguito?','Olivos','crop']]],
['Yoli','Miren Ibarguren',[
 ['¿Quién es la madre de Yoli?','Menchu Carrascosa','person'],['¿Cómo se llama el hermano de Yoli?','Josito','name'],['¿Qué hermano de Amador es pareja de Yoli?','Teodoro Rivas','person'],['¿De qué nombre es diminutivo Yoli?','Yolanda','name']]],
['Menchu','Loles León',[
 ['¿Quién es la hija de Menchu?','Yoli','person'],['¿Cómo se llama el hijo de Menchu?','Josito','name'],['¿Qué apellido tiene Menchu?','Carrascosa','surname'],['¿Qué cargo asume Menchu en la temporada 11?','Presidenta','role']]],
['Agustín','Carlos Areces',[
 ['¿Qué pianista es amigo de Agustín?','Bruno Quiroga','person'],['¿Quién alquila una habitación a Agustín en Villa Borderline?','Amador Rivas','person'],['¿Cuánto paga Agustín por la habitación en Villa Borderline?','300 euros','amount'],['¿Cuál es una de las personalidades de Agustín?','Don Simón','name']]],
['Marquesa','Mamen García',[
 ['¿Cómo se llama la marquesa?','Victoria Rafaela','name'],['¿Cómo se llama la hermana de la marquesa?','Noelia','name'],['¿De qué lugares es marquesa Victoria Rafaela?','Francavilla y Sacromonte','place'],['¿En qué edificio vive la marquesa?','Contubernio 49','home']]],
['Bruno','Luis Merlo',[
 ['¿Cuál es la actividad artística de Bruno?','Pianista','job'],['¿Qué apellido tiene Bruno?','Quiroga','surname'],['¿Qué psicóloga atiende a Bruno?','Judith Becker','person'],['¿Qué personaje comparte con Bruno su amistad desde el psiquiátrico?','Agustín Gordillo','person']]],
['Araceli','Isabel Ordaz',[
 ['¿Quién fue el marido de Araceli?','Enrique Pastor','person'],['¿Cómo se llama el hijo de Araceli?','Fran','name'],['¿Qué profesión ejercía Araceli al principio?','Peluquera','job'],['¿Qué pareja acompaña a Araceli cuando regresa a Montepinar?','Reyes','person']]],
['Mari Tere','Gemma Cuervo',[
 ['¿Qué apellido tiene Mari Tere?','Valverde','surname'],['¿Con qué vecina comparte Mari Tere el piso piloto?','Izaskun Sagastume','person'],['¿Qué vivienda ocupan Mari Tere e Izaskun?','Piso piloto','home'],['¿Qué compran Mari Tere e Izaskun para combatir el aburrimiento?','Un coche','object']]],
['Izaskun','Mariví Bilbao',[
 ['¿Qué apellido tiene Izaskun?','Sagastume','surname'],['¿Con qué vecina comparte Izaskun el piso piloto?','Mari Tere Valverde','person'],['¿Qué vivienda ocupan Izaskun y Mari Tere?','Piso piloto','home'],['¿Cómo llaman Izaskun y Mari Tere a Raquel?','Miranda','name']]],
['Charo','Emma Penella',[
 ['¿Quién es la hija de doña Charo?','Araceli Madariaga','person'],['¿Quién es el yerno de doña Charo?','Enrique Pastor','person'],['¿Quién es el nieto de doña Charo?','Fran','name'],['¿Qué animal llega al jardín de los Pastor por una herencia de la hermana de Charo?','Una vaca','animal']]],
['Maxi','Eduardo Gómez',[
 ['¿Qué apodo tiene Maxi?','Mente Fría','nickname'],['¿Qué trabajo tiene Maxi al principio de la serie?','Conserje','job'],['¿Cómo se llama el bar que regentan Maxi y Enrique?','Max & Henry','business'],['¿Qué apellido tiene Maxi?','Angulo','surname']]],
['Leo','Luis Miguel Seguí',[
 ['¿Qué apellido tiene Leo?','Romaní','surname'],['¿Con quién viaja Leo cuando sufre un accidente de paracaídas?','Alba Recio','person'],['¿Qué actividad provoca el accidente mortal de Leo?','Paracaidismo','sport'],['¿Qué Cuqui llora y dedica unas palabras a Leo en su despedida?','Amador Rivas','person']]],
['Alba','Víctor Palmero',[
 ['¿Quién es el padre de Alba?','Antonio Recio','person'],['¿Quién es la madre de Alba?','Berta Escobar','person'],['¿Qué hermano de Amador mantiene una relación con Alba?','Teodoro Rivas','person'],['¿Qué apellido tiene Alba?','Recio','surname']]]
];
const extras={business:['Cafebrería Quiroga'],food:['Paella','Croquetas'],product:['Material de oficina','Ropa deportiva'],event:['Un embargo bancario','Una mudanza'],role:['Conserje','Administrador de fincas'],home:['Un chalet en la playa','Una casa rural'],object:['Paneles publicitarios','Una motocicleta'],crop:['Viñedos','Naranjos'],amount:['100 euros','900 euros'],animal:['Una oveja','Un caballo'],sport:['Submarinismo','Esquí']};
const pools={actor:definitions.map(d=>d[1])};
for(const [,,facts] of definitions)for(const [,answer,type]of facts)(pools[type]??=[]).push(answer);
for(const [key,values]of Object.entries(extras))(pools[key]??=[]).push(...values);
function shuffle(values,random){const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export const DUEL_CHARACTERS=definitions.map(([name,actor,facts],i)=>({id:`avatar-${i+1}`,name,questions:[[`¿Quién interpreta a ${name} en la serie?`,actor,'actor'],...facts].map(([prompt,answer,type],j)=>({id:`duel-${i+1}-${j+1}`,prompt,answer,type}))}));
export function chooseWheel(random=Math.random,previous=[]){
 const shuffled=shuffle(DUEL_CHARACTERS,random);
 // Guarantee a different set after returning to the mode, even with unlucky randomness.
 if(previous.length===8&&shuffled.slice(0,8).every(c=>previous.includes(c.id))){[shuffled[7],shuffled[8]]=[shuffled[8],shuffled[7]];}
 return shuffled.slice(0,8).map(c=>c.id);
}
export function characterRound(id,random=Math.random){
 const character=DUEL_CHARACTERS.find(c=>c.id===id);if(!character)throw Error('Personaje no válido');
 return shuffle(character.questions,random).map(q=>{const wrong=shuffle(plausibleDistractors(q.prompt,q.answer,q.type,pools[q.type]),random).slice(0,2);const options=shuffle([q.answer,...wrong],random);return {...q,options,correctIndex:options.indexOf(q.answer)};});
}
