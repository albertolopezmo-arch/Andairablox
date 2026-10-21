# Preparar Supabase para Quiz LQSA

La configuración local ya apunta al proyecto nuevo. La clave incluida en `web/supabase-config.js` es una clave publicable, diseñada para estar en el cliente. No pongas aquí una clave `service_role` ni una clave secreta.

## Crear las tablas y funciones

En el panel de Supabase, abre **SQL Editor** y ejecuta los archivos en este orden:

1. `001_stats.sql`: crea el saldo privado de cada usuario y su fila al registrarse.
2. `002_ranking_streaks.sql`: añade alias, avatar y racha, junto a las funciones para guardar el perfil, registrar una visita diaria y consultar los 20 primeros.
3. `003_daily_scoring.sql`: permite entregar el resultado del Daily y sumar 10 puntos por respuesta correcta (hasta 100), una vez por usuario y día según la hora de España. No crea otra tabla.

El ranking público expone solo alias, avatar, puntos y racha; no devuelve identificadores, monedas ni fechas de actividad.

## Permitir acceso sin registro

En **Authentication → Sign In / Providers**, habilita **Anonymous sign-ins**. Así la app podrá asignar una identidad a cada instalación sin pedir correo. Si se borran los datos de la app o se cambia de dispositivo, una cuenta anónima no se recupera automáticamente.

## Integración en la app

La URL y la clave publicable están en `web/supabase-config.js`. La app inicia sesión anónima, sincroniza el alias y avatar, lee los saldos, suma el Daily al terminar y muestra los veinte primeros del ranking. El registro diario se acredita en servidor y el cliente no puede modificar directamente el saldo.

Premios por velocidad: ejecutar 004_daily_speed_rewards.sql después de 003 y publicar el cliente actualizado a la vez. No borra saldos ni permite repetir el Daily de hoy. Aciertos: 10 + 2 por segundo entero restante; monedas: 1 + una por cada 5 segundos restantes. El servidor limita a 10 aciertos y 20 segundos por respuesta. Como en la versión anterior, el cliente comunica los aciertos; la verificación antifraude de preguntas y tiempos en servidor sigue pendiente.


## Duelo con ruleta y premios
Ejecutar 007_duels.sql, 007_duel_question_seed.sql y 008_duel_rewards.sql, en ese orden. 28 personajes con cinco preguntas cada uno. El servidor sortea ocho avatares, elige un tema compartido y valida respuesta única, tiempos y participantes. Dos modos: vecino real o máquina (65 % de acierto y velocidad variable). Los puntos humanos suman al ranking; no se crea una cuenta para la máquina. Premios: 50/10/25 monedas por victoria/derrota/empate. Se duplican una vez mediante vídeo. Una partida abandonada sin contestar no genera premio.
Los vídeos actuales usan los IDs de prueba de Google. La app espera el evento de recompensa del SDK. Como en la integración de rachas, la confirmación del vídeo depende del cliente; antes de producción hay que incorporar verificación SSV en el servidor para impedir canjes desde un cliente manipulado. No hay verificación SSV desplegada.
Las pruebas PostgreSQL se han ejecutado localmente con PGlite; todavía no se ha aplicado esta migración a Supabase ni probado el emparejamiento entre dos móviles reales.

## Tienda de vídeo
Para activar la tienda actual en una base existente, ejecuta `012_store_video.sql` en SQL Editor. Para una instalación nueva, ejecuta `011_store.sql` y después `012_store_video.sql`. La función `quiz_lqsa_buy_store_item` valida el catálogo y el precio de 300 monedas en el servidor, bloquea el saldo durante el canje y guarda el acceso una sola vez. Las compras anteriores se conservan, pero stickers y fondos ya no se ofrecen ni se pueden comprar de nuevo.
