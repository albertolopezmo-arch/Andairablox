# Revisión SEO de Andairablox — 21 de octubre de 2026

## Resultado

La versión local tiene una base técnica preparada para su publicación: 30 páginas de contenido, seis libros y tres idiomas. La auditoría local termina sin enlaces internos rotos ni referencias a imágenes inexistentes en los datos estructurados. Esto no equivale a una auditoría de la web pública, a una puntuación de Lighthouse ni a una garantía de indexación o posiciones.

## Corregido

- Doce fichas EN/FR tenían imágenes JSON-LD bajo /en/assets/ o /fr/assets/, carpetas inexistentes. Ahora utilizan /assets/ y la portada localizada disponible.
- Cada ficha comparte ahora su propia portada en Open Graph y Twitter. Se añadieron dimensiones, tipo y descripción de la imagen.
- Descripciones específicas y más concisas en los 18 documentos de libros, sin recortar las sinopsis visibles.
- Las fichas vinculan WebPage con su Book y las migas de pan siguen Inicio → Libros → título.
- La portada explica de forma visible que son libros infantiles de 7 a 12 años.
- La ficha de Halloween incluye un fragmento real del comienzo, entregado por el propietario, como texto visible. En EN/FR se conserva en español y se indica el idioma.
- Archivo 404.html con noindex para servir errores reales en Cloudflare Pages. No se utiliza una regla SPA que convierta todas las rutas desconocidas en la portada.
- Normalización explícita de URLs /index.html con reglas de ruta para Cloudflare Pages. Las redirecciones entre dominios deben configurarse en Cloudflare Rules; no están activadas.
- El verificador de archivos ya no sobrescribe las instrucciones de publicación.

## Comprobaciones realizadas

- 30 títulos únicos, 30 descripciones únicas y un H1 por página.
- 10 páginas ES, 10 EN y 10 FR, con lang, canonical y hreflang recíprocos y x-default.
- Sitemap con exactamente las 30 direcciones canónicas; robots.txt permite rastrearlas.
- El contenido principal, los enlaces de catálogo y los botones de compra están en el HTML inicial. Las animaciones y el asistente son mejoras mediante JavaScript.
- Imágenes con dimensiones y atributo alt; las portadas no se vuelven a generar con IA.
- Datos JSON-LD válidos sintácticamente y sus imágenes existentes; no se han inventado precios, valoraciones, ISBN ni disponibilidad.
- «Batalla con sus miedos» conserva inLanguage es y la edad 10–12 incluso en sus páginas informativas EN/FR.
- Los ejemplares firmados siguen restringidos a la versión española.
- El paso automático de las cuatro muestras, su cierre, reinicio y pausa al ampliar continúan pasando sus pruebas.

## Pendiente de la publicación

1. Subir esta versión al alojamiento y conectar andairablox.es con HTTPS. La vista local 127.0.0.1 no es accesible para Google.
2. Mantener la raíz de andairablox.es. Esta versión utiliza /en/ y /fr/ bajo ese dominio; decidir la migración de los antiguos andairablox.com y andairablox.fr y configurar las redirecciones 301 que correspondan. No dejar copias equivalentes compitiendo entre sí. Si se prefieren los dominios separados, ajustar antes los canonical/hreflang y la estructura de publicación.
3. Verificar DNS, respuesta 200 para las páginas válidas, 404 para una ruta inventada y redirección de www y HTTP hacia la dirección preferida. En Cloudflare, las reglas entre dominios se configuran en el panel, no como reglas de hostname dentro de _redirects.
4. Verificar el dominio en Google Search Console, enviar https://andairablox.es/sitemap.xml y solicitar la indexación de la portada y la ficha de Halloween. No se ha accedido a esa cuenta ni se ha enviado ninguna URL.
5. Pasar PageSpeed Insights y la prueba de resultados enriquecidos sobre las URLs públicas. No se han medido Core Web Vitals reales ni se atribuye una puntuación de rendimiento.
6. Completar los tres enlaces Amazon franceses que siguen pendientes: Diario de una Youtuber, Aventuras de vacaciones y El código perdido. Por ahora llevan al sitio francés original y se indica la limitación.

## Plazos y seguimiento

Google indica que un rastreo solicitado puede tardar desde unos días hasta unas semanas y no garantiza la inclusión. Rastreo, indexación y posicionamiento son etapas distintas. No se promete estar primero ni aparecer antes de Halloween. Al publicar, revisar impresiones, consultas, páginas indexadas y clics reales en Search Console. Los datos estructurados y el sitemap ayudan a entender y descubrir la web; no garantizan resultados enriquecidos ni una posición.

## Referencias oficiales

- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/redirects/
