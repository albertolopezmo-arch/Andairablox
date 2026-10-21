# Quiz LQSA 0.2.5 — Daily, Duelo, tienda y perfiles

Proyecto Android y HTML. Mantiene el identificador `com.almdevil.quizlqsa`; versión 0.2.5, código 9.

## Antes de probar la actualización
En el proyecto Supabase de Quiz LQSA, abre SQL Editor y ejecuta **ACTUALIZAR-SUPABASE.sql**. Este archivo actualiza una instalación que ya tiene los SQL 001, 002 y 003 del ZIP anterior. Conserva los usuarios, puntos, monedas y ranking. Si detecta alias duplicados, cancela la actualización completa; no cambia alias automáticamente. Para un proyecto nuevo, ejecutar primero backend/001_stats.sql, 002_ranking_streaks.sql y 003_daily_scoring.sql.

La actualización SQL no se ha aplicado al proyecto remoto desde este chat. La URL y la clave publicable existentes están en web/supabase-config.js; no hay claves secretas en el ZIP.

## Cambios incluidos
- Daily: 20 segundos por pregunta; premios de puntos y monedas según rapidez. Un Daily al día por usuario, según el calendario de España.
- Duelo: rival real por emparejamiento o máquina. Si la búsqueda supera 25 segundos ofrece jugar contra la máquina.
- Ruleta: ocho avatares aleatorios al entrar. El personaje elegido determina las cinco preguntas. En online ambos jugadores comparten ruleta, personaje y preguntas.
- Máquina: aproximadamente 65 % de acierto, con respuestas entre 3 y 17 segundos. No tiene cuenta, no recibe monedas y sus puntos no entran en el ranking. Los puntos del jugador humano sí cuentan.
- Premios del Duelo: 50 monedas al ganar, 10 al perder, 25 por empate. Al terminar, un vídeo duplica solo las monedas. El servidor acredita cada premio una sola vez. No se premia abandonar sin contestar ninguna pregunta.
- Perfil: curiosidad y una frase del personaje del avatar; debajo puntos, monedas y racha. Premios por racha cada cinco días, en ciclos de treinta, con vídeo (600, 800, 1000, 1200, 1400 y 1600 monedas).
- 28 avatares ilustrados con fondo crema. Se puede deslizar entre páginas, además de usar los puntos.
- Alias: comprobación de disponibilidad con marca verde o cruz roja. Continuar bloqueado mientras no esté disponible. Exclusividad sin distinguir mayúsculas.
- Tienda: vídeo de tomas falsas canjeable una sola vez por 300 monedas, con acceso guardado en Supabase y reproductor integrado en una pantalla de la app.

## Vídeos de prueba
La app incorpora los identificadores de prueba de Google AdMob. El canje se solicita tras recibir la confirmación de recompensa del SDK; cerrar antes el vídeo no da el bonus. Si falla el cobro, queda pendiente para reintentar sin repetir el vídeo. El navegador HTML no simula anuncios; el vídeo se prueba en Android.

Antes de publicar anuncios reales faltan los identificadores propios, configuración de consentimiento y verificación de recompensas SSV en el servidor. Los canjes por vídeo actuales confían en la confirmación del cliente. Ver backend/README.md.

## Compilar desde GitHub
Subir el contenido del ZIP a la raíz del repositorio. En Actions, ejecutar **Quiz LQSA - APK de prueba**, o publicar una Release: el flujo adjunta el APK. No subir la carpeta del proyecto como un nivel adicional. El APK es de prueba con firma debug, no un paquete de publicación para Play Store.

## Probar en HTML
Servir web/ con un servidor HTTP y abrir index.html. web/preview-duel.html es una demostración local contra la máquina, sin cuenta ni premios, separada del Duelo real de la app.

## Validación realizada
- 25 pruebas de lógica aprobadas.
- Migraciones y funciones ejecutadas en PostgreSQL local (PGlite): emparejamiento, sorteo compartido, preguntas del personaje, tiempos, respuesta única, aislamiento, premios y bonus sin duplicados, máquina sin cuenta y actualización repetible sin alterar saldos.
- APK Android compilado correctamente. El emparejamiento entre dos móviles y la reproducción del anuncio necesitan prueba en dispositivos tras cargar el SQL.

Con Node.js: `npm install` y `npm test`. Prueba PostgreSQL local adicional: `npm run test:database`.

Para activar la tienda del vídeo en una instalación ya configurada, ejecuta `backend/012_store_video.sql` en Supabase. Para una instalación nueva, ejecuta `backend/011_store.sql` y después `backend/012_store_video.sql`, o usa el archivo completo `ACTUALIZAR-SUPABASE.sql`. La migración conserva las compras antiguas en la base de datos, pero ya no permite comprar stickers ni fondos. El vídeo se canjea una vez por 300 monedas y queda guardado en la cuenta.

Daily: al terminar muestra un intersticial de prueba y ofrece un vídeo recompensado opcional para duplicar solo las monedas. Requiere backend/010_daily_ads_rewards.sql (incluido en ACTUALIZAR-SUPABASE.sql). Canje único por fecha; el resultado y el premio base se guardan antes del anuncio.
