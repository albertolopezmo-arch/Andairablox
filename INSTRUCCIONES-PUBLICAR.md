# Publicar Andairablox

La carpeta dist contiene la web completa: 30 páginas de contenido, 6 libros, ES/EN/FR, asistente guiado, gato animado y muestra de Halloween. La web pública y sus DNS no se han modificado.

## Subirla a Cloudflare Pages

Sube el contenido de dist, con index.html en la raíz y conservando las carpetas. Es HTML estático: no requiere instalar dependencias ni compilar en el alojamiento. Conecta tu dominio andairablox.es y activa HTTPS siguiendo el asistente del proveedor. Si el dominio sigue conectado a Canva, deberás cambiar la configuración del dominio al nuevo alojamiento.

Esta versión está preparada para https://andairablox.es/, /en/ y /fr/. Antes de conectar los antiguos dominios .com y .fr, decide si se redirigirán hacia estas versiones. Si quieres publicar cada idioma en un dominio independiente, habrá que adaptar las URL canónicas, hreflang y la estructura antes de subirla. Conserva una copia del sitio actual y de la configuración DNS.

Cloudflare Pages reconoce 404.html y normaliza URLs index.html. El archivo _redirects contiene solo redirecciones de rutas. Las reglas www → dominio principal y las migraciones .com/.fr se configuran en Cloudflare Rules, no mediante fuentes con hostname en _redirects. No se ha aplicado ninguna redirección externa.

Una vez pública, verifica respuestas 200/404, dominio preferido y HTTPS; da de alta el dominio en Search Console y envía https://andairablox.es/sitemap.xml. Solicita la indexación de la portada y la ficha de Halloween. Consulta SEO-REVISION.md para el resultado de la revisión y las comprobaciones que requieren la web publicada. No se garantiza una fecha ni una posición en Google.

## Contenido y limitaciones actuales

Los enlaces de Halloween apuntan a su edición por idioma. Faltan los enlaces Amazon directos de tres títulos franceses; temporalmente llevan al sitio francés y se indica la limitación. «Batalla con sus miedos» corresponde a la edición española facilitada, para lectores de 10 a 12 años. Sus fichas informativas también se traducen, identificando el idioma del libro.

Las cuatro muestras de Halloween están en español; se indica en los lectores EN/FR. Pasan solas y el libro se cierra, con pausa al ampliar para leer. Los ejemplares firmados se ofrecen solo en español.

El asistente «El gato de Andairablox» utiliza respuestas preparadas y recomendaciones por tema y edad. No hace llamadas a una IA externa ni guarda conversaciones. Los precios y la entrega se consultan en Amazon. No se incluyen analítica, anuncios ni formularios.

## Editar y regenerar

El generador es build.py; las traducciones están en translations.json y los ajustes multilingües en localize.py. Los estilos y la interacción se editan en dist/assets. Ejecuta build.py y después localize.py; este último ejecuta también seo.py, que mantiene los metadatos, las imágenes SEO y el documento 404. Comprueba el resultado con verify.py, audit-seo.py y verify-autoplay.mjs. Estos verificadores no cambian las instrucciones.
