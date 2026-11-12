# jatoGifs

Extensión Manifest V3 para elegir GIF de la colección de **jatoGifs** escribiendo `/gif` en los editores de conversación de **github.com**.

## Estado de esta entrega · 1.1.1

**La colección inicial incluye ocho GIF de tonela10 y [Test production testing](https://giphy.com/gifs/test-production-testing-o5usW6VUC2TkUrC42m), de perekng.** jatoGifs los recupera por ID con la API oficial. Los nuevos GIF de tonela10 se añaden manualmente desde Configuración.

El repositorio y los ZIP no incluyen una clave de GIPHY. Guarda tu clave de aplicación desde **Configuración → Conectar GIPHY** y pulsa **Comprobar GIF**. GIPHY aplica a la clave el cupo de tu aplicación.

## Instalar gratis en Brave o Chrome

1. Descarga y descomprime `jatoGifs-1.1.1.zip` en una carpeta que quieras conservar.
2. Abre `brave://extensions` en Brave o `chrome://extensions` en Chrome.
3. Activa **Modo desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`.
5. Recarga las pestañas de GitHub que ya estuvieran abiertas.

Si usas el código fuente, selecciona la subcarpeta **extension**, no la raíz del proyecto. No muevas ni borres esa carpeta mientras uses la extensión. En navegadores administrados por tu empresa, una política puede impedir la instalación manual.

En Edge el acceso equivalente es `edge://extensions`. En otros Chromium, utiliza su página de extensiones y comprueba el resultado.

## Instalar en Firefox

Requiere Firefox 140 o posterior (Firefox para Android 142).

1. Abre `about:debugging#/runtime/this-firefox`.
2. Pulsa **Cargar complemento temporal…** y selecciona `manifest.json` dentro de la carpeta descomprimida (o de **extension** si usas el código fuente).
3. Recarga las pestañas de GitHub que ya estuvieran abiertas.

Los complementos temporales se eliminan al cerrar Firefox. Para una instalación permanente hay que firmar el ZIP en [addons.mozilla.org](https://addons.mozilla.org/developers/) (puede ser como distribución no listada).

## Usar el selector

En el cuerpo de un issue, pull request, Discussion, comentario o revisión de GitHub, escribe `/gif` al principio o después de un espacio. Aparecerá la galería junto al editor.

- Haz clic en un GIF o usa las flechas y Enter.
- Pulsa Tab para entrar en la galería y acceder a «Cargar más», «Configuración» o «Reintentar» con el teclado.
- Escape cierra el selector y conserva el comando.
- La selección reemplaza únicamente `/gif` por Markdown de imagen. El resto del borrador se conserva. Deshaz con Cmd+Z en macOS o Ctrl+Z en Windows/Linux.
- Previsualiza el comentario antes de publicarlo. La extensión no lo publica automáticamente ni sube el GIF como archivo adjunto.

No se activa dentro de código Markdown, nombres de usuario, URL, el editor de archivos, campos de título o páginas ajenas a github.com. Los editores compatibles utilizan los campos de texto de conversación de GitHub; cambios futuros de su interfaz pueden requerir actualizar la extensión.

## Añadir, quitar y comprobar GIF

Abre **Configuración** desde el selector o el icono de jatoGifs. En **Tu colección**, pega un enlace de página de GIPHY por línea. También se aceptan los ID, hasta un máximo de 100 GIF. Se admiten los del canal tonela10 y el GIF de perekng indicado arriba. Si ya tenías una colección personalizada, pega su enlace para añadirlo a tu lista. Elimina una línea para quitar un GIF. Pulsa **Guardar colección**: los enlaces se validan mediante la API antes de sustituir la selección anterior. Se guardan únicamente los ID. Si un enlace es inválido, corresponde a otro canal o no está disponible, la colección anterior se conserva.

Pulsa **Comprobar GIF** para revisar la colección guardada. Cierra el selector y vuelve a escribir `/gif` para ver los cambios. La consulta a GIPHY es nueva en cada apertura; no se guardan las respuestas ni los archivos. Si GIPHY elimina uno de los GIF, aparecerá un aviso para revisar la colección.

Guarda la clave antes de comprobar el acceso. **Borrar clave local** elimina la clave que guardaste en el navegador. No escribas claves en los archivos que subas a GitHub.

## Actualizaciones y desinstalación

Para actualizar, reemplaza los archivos de la carpeta instalada por los de la nueva versión y pulsa **Recargar** en la página de extensiones. Recarga también GitHub. Las actualizaciones de esta instalación son manuales.

Para desinstalar, pulsa **Quitar** en la página de extensiones. Se elimina la configuración local. No hace falta pagar ni registrarse en Chrome Web Store.

## Desarrollo y pruebas

No hay dependencias en tiempo de ejecución. Para las pruebas unitarias necesitas Node.js 20 o posterior:

```sh
npm test
```

Para generar el ZIP instalable y el ZIP del código, con Python 3:

```sh
npm run package
```

Las pruebas de integración opcionales usan una instalación existente de Playwright y un ejecutable Chromium compatible:

```sh
JATO_BROWSER="/ruta/al/navegador" node tests/browser.cjs
```

El arnés crea un perfil temporal separado, intercepta GitHub y GIPHY con datos sintéticos y lo elimina al terminar. No lee tu perfil habitual ni publica comentarios. `tests/live.cjs` comprueba además los nueve GIF e imágenes con la API real, usando un editor de prueba sintético y aislado. El informe de verificación distingue ambos tipos de pruebas.

Para comprobar la API real (consume una llamada de su cupo), proporciona tu clave como variable de entorno `GIPHY_API_KEY`:

```sh
node scripts/check-channel.cjs
```

## Privacidad y recursos

Lee `extension/privacy.html`, `THIRD-PARTY.md` y `VERIFICACION.md`. El texto de los borradores permanece en el navegador. La extensión no lee el portapapeles ni solicita tokens de GitHub. Las solicitudes y miniaturas de GIPHY transmiten al servicio los datos de red normales de una conexión HTTPS.

Esta es una extensión independiente; no está patrocinada por GitHub ni GIPHY.
