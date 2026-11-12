# jatoGifs

Extensión Manifest V3 para Brave y Chrome. Escribe `/gif` en un editor de conversación de GitHub, elige un GIF y jatoGifs lo inserta como imagen Markdown en tu borrador.

## Instalar o actualizar

1. Descarga el ZIP instalable y descomprímelo. Conserva la carpeta descomprimida.
2. Abre `brave://extensions` o `chrome://extensions` y activa **Modo desarrollador**.
3. Para una instalación nueva, pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`. Si ya tenías jatoGifs, sustituye los archivos dentro de la carpeta instalada y pulsa **Recargar** para conservar la configuración del navegador.
4. Recarga las pestañas de GitHub. Escribe `/gif` al principio de una línea o después de un espacio. Elige con el ratón o con las flechas y Enter. Esc cierra el selector.

El ZIP no contiene una clave de GIPHY. Si todavía no tienes una guardada, añádela en **Configuración → Conectar GIPHY** y pulsa **Comprobar GIF**.

## Añadir un GIF

1. Abre [jato.sediles.dev](https://jato.sediles.dev/). Cualquiera puede añadir un GIF sin iniciar sesión; solo el propietario puede quitar GIF desde el panel de administración.
2. Pega el enlace de un GIF de GIPHY o su ID y pulsa **Añadir GIF**.
3. Cierra y vuelve a abrir `/gif` en GitHub. No tienes que actualizar la extensión cada vez que cambie la colección.

La colección se guarda en Cloudflare D1. [El catálogo de lectura](https://jato.sediles.dev/api/catalog) solo devuelve los ID; la extensión obtiene las imágenes directamente de GIPHY. Si conservabas una lista personalizada en la versión anterior, puedes copiar sus enlaces desde **Configuración → Ver mi antigua colección local**.

## Desarrollo

Carga la carpeta `extension` como extensión descomprimida. El Worker y la migración inicial están en [cloudflare](cloudflare/README.md).

- `npm test`: pruebas de la extensión.
- `npm run test:cloudflare`: pruebas del Worker, validación de sesión y SQL real en memoria. Requiere Node.js 22 o posterior.
- `npm run package`: construye los ZIP instalable y de código sin la clave de GIPHY. Requiere Python 3.
- `node tests/browser.cjs`: prueba aislada con Playwright y Brave, con respuestas simuladas. `tests/live.cjs` admite `GIPHY_API_KEY` y usa el catálogo desplegado, GIPHY real y un editor sintético.
