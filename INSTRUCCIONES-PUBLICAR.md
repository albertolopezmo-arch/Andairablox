# Publicar Andairablox

Este ZIP está preparado para sustituir el contenido del repositorio que publica `andairablox.es` mediante GitHub Pages.

## Contenido

- `index.html` y las carpetas públicas están en la raíz.
- `admin/index.html` contiene el panel privado.
- `assets/analytics.js` registra visitas e interacciones sin cambiar el aspecto de la web.
- `.github/workflows/seo-semanal.yml` revisa semanalmente el SEO.
- `scripts/seo-audit.mjs` realiza la auditoría.

## Subida

Sube todo el contenido del ZIP conservando las carpetas, incluida `.github`. Sustituye los archivos existentes del repositorio. El archivo `CNAME` mantiene el dominio `andairablox.es`.

Después de que GitHub Pages termine la publicación, el panel estará en:

<https://andairablox.es/admin/>

Los datos empiezan a registrarse desde la publicación; no se recuperan visitas anteriores.

La auditoría semanal necesita dos ajustes en GitHub Actions que se harán desde la web de GitHub:

- Variable `SUPABASE_URL`: `https://armxwudysadqejsrahok.supabase.co`
- Secreto `SEO_INGEST_SECRET`: debe coincidir con el valor guardado en Supabase.

No publiques claves secretas en archivos. La clave incluida en `assets/analytics-config.js` es la clave publicable prevista para uso en navegador; la base de datos está protegida mediante RLS y la función comprueba el usuario administrador.
