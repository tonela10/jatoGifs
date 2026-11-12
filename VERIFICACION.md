# Verificación de jatoGifs

## Versión 1.3.0 · 12 de noviembre de 2026

- Pasan 21 pruebas automatizadas de la extensión y del Worker. El contrato del catálogo y el código del Worker no cambian.
- En perfiles limpios de Brave 157.0.8103.39 y Chrome for Testing 157.0.8103.78, los nueve GIF reales cargaron sin clave. Se insertó un GIF y se mostró su imagen original en el editor de demostración. El renderizador de Markdown de GitHub también reconoció la imagen; no se publicó ningún comentario.
- Las pruebas de integración cubren teclado, paginación, catálogo vacío, fallo de conexión, recuperación de miniatura, imagen no disponible y alta desde el formulario real del Worker con SQLite en memoria. Al volver a abrir el selector aparece el alta.
- En ambos navegadores, la actualización descomprimida desde el ZIP 1.2.1 conservó la identidad y la antigua lista local, y eliminó únicamente la clave ficticia de prueba al pulsar Recargar.
- Los dos paquetes excluyen el antiguo archivo de configuración; la extensión empaquetada no concede permiso ni hace peticiones a la API de GIPHY.
- En un perfil limpio de Firefox 160.0 para macOS, el ZIP cargado como complemento temporal mostró los nueve GIF sin clave, insertó Markdown con ratón y teclado en un borrador local dentro de github.com y abrió la configuración. Firefox para Android no se ha probado.

## Versión 1.2.1 · 12 de noviembre de 2026

- Pasan 26 pruebas automatizadas. Se comprueban las altas en SQLite, duplicados, límites de solicitudes, el tope de 100 GIF y que solo el propietario puede quitar entradas.
- En producción, Brave sin sesión abrió el formulario público por la URL antigua y la web rechazó un duplicado y un ID no verificable sin cambiar los nueve GIF. La ruta de administración redirige a Cloudflare Access.
- Brave muestra la extensión instalada 1.2.1 habilitada. Su opción «Comprobar GIF» confirmó los nueve GIF de Cloudflare y GIPHY.

## Versión 1.2.0 · 12 de noviembre de 2026

- Pasan 23 pruebas automatizadas: la extensión, el Worker con SQLite en memoria y la verificación criptográfica de tokens de Cloudflare Access.
- En Brave aislado, el selector conserva las páginas de la lista abierta y usa los cambios del catálogo en la siguiente apertura.
- Con Cloudflare y GIPHY reales, Brave cargó nueve GIF e insertó uno como Markdown en un editor sintético. No se publicó ningún comentario.
- En producción, el catálogo devuelve nueve IDs sin sesión, el panel redirige a Access y una solicitud de escritura sin sesión no modifica la base. El flujo de escritura con sesión se comprobó en la prueba local.

## Versión 1.1.1 · 11 de noviembre de 2026

- 21 pruebas unitarias pasan. La colección inicial incluye el GIF `o5usW6VUC2TkUrC42m`; solo se acepta ese ID del usuario `perekng`.
- La API de GIPHY devuelve 9 de 9 GIF. En un perfil aislado de Brave se cargaron las nueve miniaturas y se insertó el GIF nuevo como Markdown en un editor sintético. No se publicó ningún comentario.
- La copia de GitHub y los paquetes se distribuyen sin la clave de GIPHY.

## Historial: versión 1.1.0

Fecha: 29 de octubre de 2026. Entorno de ejecución: macOS.

## Resultado y límite principal

El usuario ha sustituido la sincronización automática por una colección manual de ID. **La API oficial Get GIFs by ID devuelve los ocho GIF reales de tonela10.** La búsqueda `@tonela10` sigue vacía y ya no se utiliza en la extensión. Se almacenan los ID elegidos, nunca archivos multimedia ni sus URL.

No se han enviado solicitudes a soporte ni a Creator. No se han solicitado servicios Enterprise ni realizado pagos. Se mantiene la distribución e instalación manual. La copia del perfil habitual de Brave se ha recargado y muestra la versión 1.1.0; la comprobación de la propia extensión confirma «8 de 8 GIF disponibles».

## Pruebas automatizadas

**20/20 pruebas unitarias pasan**, usando el ejecutor incluido en Node.js:

- Comando exacto y posición del cursor; exclusión de URL, palabras mayores y código Markdown.
- Sustitución al principio, en medio y al final, conservación del resto del texto y rechazo de un borrador modificado.
- Escape de etiquetas Markdown, conservación de parámetros de URL y rechazo de URL ajenas o inseguras.
- API oficial por ID, rechazo de GIF ajenos a tonela10, orden y URL conservados, paginación local por ID, GIF eliminados, clave inválida, desconexión, límite 429 y respuestas inválidas.
- Entrada de enlaces de GIPHY o ID, deduplicación, mensajes por línea inválida y límite de 100 ID.
- Autorización de mensajes por origen, tipo de página y pestaña; rechazo de selección externa.
- Recuperación del encaminamiento tras reiniciar el worker, sin guardar GIF ni URL multimedia en almacenamiento de sesión.

También pasan las comprobaciones de sintaxis de los scripts de la extensión.

## Navegadores

| Navegador | Motor informado por el navegador | Resultado |
| --- | --- | --- |
| Brave instalado | 151.0.7922.173 | Integración aislada: pasa |
| Edge instalado | 156.0.4314.50 | Integración aislada: pasa |
| Google Chrome | No instalado en este equipo | No ejecutado |
| Chromium independiente | Sin binario completo disponible | No ejecutado |

Las pruebas de regresión cargan la extensión real en un perfil temporal y proporcionan páginas GitHub y respuestas GIPHY **sintéticas**, mediante interceptación de red. También verifican guardar una colección y conservarla si una entrada posterior es inválida. No son una certificación de compatibilidad con cada editor del GitHub real.

Escenarios que pasan en Brave y Edge: iframe con una política CSP restrictiva en la página anfitriona, inserción con Enter, deshacer nativo, inserción dentro de texto, conservación de otros borradores, Tab y flechas con foco real, acceso a paginación con teclado, temas claro/oscuro, cancelación al cambiar el borrador, 401/429/sin conexión/catálogo vacío, exclusión del editor de código, editor añadido dinámicamente, zoom CSS al 125 %, ventana compacta y navegación a otra página.

Las capturas con «datos-sinteticos» en su nombre corresponden a pruebas de regresión. Las evidencias `gallery-live.png`, `settings-live.png` y el informe `live-report.json` corresponden a una prueba separada con GIPHY real y un editor sintético; se indican así dentro de la propia captura. No se ha publicado ningún comentario.

## Revisión de interfaz

El detector mecánico de calidad HTML/CSS no encontró incidencias. Un agente de revisión separado señaló dos fallos de accesibilidad: entrada por teclado al iframe y anuncio de la selección. Se corrigieron y se comprobaron mediante aserciones de foco real y una región de estado accesible. El revisor dio disposición **ship para ese ámbito revisado**. La ampliación de Configuración de 1.1.0 también se revisó por separado con las capturas de escritorio, ventana compacta y galería real, sin defectos materiales.

## Pendiente de verificación real

- Las nuevas subidas se añaden manualmente; no hay sincronización automática del canal en esta versión.
- Probar los formularios actuales de issues, PR, revisiones y Discussions en una sesión real de GitHub; confirmar sus menús de comandos y la previsualización del GIF.
- Una publicación de comentario de prueba requiere un destino y autorización del usuario; no se ha publicado ningún comentario.
- Comprobar con lector de pantalla real. Los tests verifican foco y atributos, no una sesión auditiva.
- Comprobar Chrome y Chromium independiente, y otros sistemas operativos, antes de anunciar compatibilidad probada con ellos.

## Reproducibilidad

`npm test` ejecuta las pruebas unitarias. `tests/browser.cjs` requiere una instalación disponible de Playwright; `JATO_BROWSER` permite elegir el ejecutable y `JATO_ARTIFACTS` el directorio para las evidencias. `scripts/check-channel.cjs` realiza una consulta real y no guarda la respuesta ni medios. `npm run package` genera los ZIP con el manifiesto en la raíz del paquete instalable.

Para repetir la prueba de Firefox, indica las rutas de Firefox, GeckoDriver y el ZIP instalable en `JATO_FIREFOX`, `JATO_GECKODRIVER` y `JATO_ZIP`, y ejecuta `node tests/firefox.cjs`. La prueba usa un perfil temporal y requiere acceso a GitHub y al catálogo público.
