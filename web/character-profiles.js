// Textos vinculados al orden de avatares confirmado por el usuario.
// Referencias de las citas: CHARACTER-SOURCES.md.
const facts=[
['Fermín','Es el padre de Lola y presume de sus habilidades preparando espetos.','¡Ay, mi niña!'],
['Berta','Comparte con Antonio el negocio Mariscos Recio y es la madre de Alba.','¡No blasfemes!'],
['Antonio','Su negocio se llama Mariscos Recio y su especialidad es vender pescado y marisco congelado.','Mayorista, no limpio pescado.'],
['Fina','Su nombre completo empieza por Josefina y su apellido es Palomares.','¡Yo sólo soy una anciana indefensa!'],
['Judith','Es psicóloga y tiene con Enrique un hijo llamado Dylan.','Imagínate que…'],
['Javier','Es hijo de Vicente y Goya; los vecinos lo conocen como el Pelocho.','¿Café?'],
['Lola','Es hija de Fermín y Estela, y viaja a Miami para trabajar como actriz.','¡Yo soy actriz!'],
['Amador','Su hermano es Teodoro y comparte con Maite el apodo de los Cuquis.','¡Merengue, merengue!'],
['Teodoro','Es hermano de Amador y desarrolla su faceta musical como DJ.','Soy DJ Theo con h intercalada.'],
['Raquel','Es prima de Nines y trabajó como comercial de una constructora.','No, no es eso. Bueno, ¡un poco sí!'],
['Maite','Es conocida como la Cuqui y una de sus hijas es Carlota.','Me caigo muerta.'],
['Vicente','Su hijo es Javi y su afición al sofá le gana el apodo de hombre cojín.','¡Qué pereza!'],
['Enrique','Fue concejal de Juventud y Tiempo Libre y es padre de Fran y Dylan.','Enrique Pastor, concejal de Juventud y Tiempo Libre.'],
['Coque','Trabaja de conserje-jardinero y su caravana llega a servir de hogar a Amador.','¡Señor Delfín!'],
['Chusa','Su nombre es María Jesús; en una trama ayuda a Maite a escribir una novela.','¡Que te pinsho!'],
['Minguito','Sus generadores eólicos en el olivar de Villazarcillo lo convierten en millonario.','Raquel, Raquel.'],
['Yoli','Su madre es Menchu, su hermano es Josito y mantiene una relación con Teodoro.','¡Mamá, te odio!'],
['Menchu','Es la madre de Yoli y Josito, y llega a presidir la comunidad.','Parece que nos conocemos de toda la vida.'],
['Agustín','Es amigo de Bruno y alquila una habitación a Amador en Villa Borderline.','Si es que soy un mierdas, no te merezco.'],
['Marquesa','Se llama Victoria Rafaela y es marquesa de Francavilla y Sacromonte.','Modesto era todo un caballero.'],
['Bruno','Es pianista y en la etapa de Contubernio abre una cafetería-librería.','Tuyo en la distancia.'],
['Araceli','Es la madre de Fran y al principio de la serie ejerce de peluquera.','Me siento la Pantoja.'],
['Mari Tere','Ocupa el piso piloto con Izaskun y ambas llegan a comprarse un coche.','¡Cu cu!'],
['Izaskun','Comparte el piso piloto con Mari Tere y su apellido es Sagastume.','¡Bombazo informativo!'],
['Charo','Es la madre de Araceli y la abuela de Fran.','¡Papel!'],
['Maxi','El bar Max & Henry toma su nombre de Maxi y su socio Enrique.','¡Mente fría!'],
['Leo','Su apellido es Romaní y reivindica la vida de soltero como una elección.','Yo es que soy single.'],
['Alba','Es hija de Antonio y Berta, y mantiene una relación con Teodoro.','Lo que hay que curar no es la homosexualidad, sino la homofobia.']
];
export const CHARACTER_PROFILES=Object.fromEntries(facts.map(([name,curiosity,quote],i)=>[`avatar-${i+1}`,{name,curiosity,quote}]));
