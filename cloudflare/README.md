# Catálogo en Cloudflare

El Worker `jatogifs-catalog` sirve `jato.sediles.dev`. Guarda en D1 únicamente los ID de GIPHY en orden de incorporación, hasta 100.

| Ruta | Acceso | Uso |
| --- | --- | --- |
| `/` | Público | Redirige al panel |
| `/admin` | Cloudflare Access | Ver, añadir y quitar GIF |
| `/api/catalog` | Lectura pública | Devuelve `{"version":1,"ids":[...]}` |

La extensión lee una lista nueva cada vez que abres el selector. Los IDs de la lista se conservan en memoria de sesión para mantener estables las páginas de un selector ya abierto. Ni el Worker ni D1 necesitan la clave de GIPHY; el navegador consulta a GIPHY con la que se haya guardado en la extensión. El panel valida el formato del enlace o ID, y la extensión indica si GIPHY no devuelve alguno.

## Despliegue

1. Crea una base D1 y aplica `migrations/0001_catalog.sql` una sola vez. La migración incluye los nueve GIF de la versión 1.1.1. Si vuelves a ejecutar la migración, se volverían a añadir GIF iniciales que ya se hayan quitado.
2. Configura una aplicación de Cloudflare Access de tipo self-hosted para `jato.sediles.dev/admin`, con una política Allow para el correo propietario. Usa el proveedor de códigos de un solo uso existente. No protejas `/api/catalog` con esta política.
3. Sube `worker.mjs` como módulo principal y `access.mjs` y `admin.mjs` como módulos auxiliares, con el binding D1 `CATALOG_DB`. Configura en Cloudflare `ACCESS_ISSUER` (URL HTTPS del equipo Access), `ACCESS_AUD` (audiencia de la aplicación) y `ADMIN_EMAIL` (correo permitido).
4. Asocia el dominio personalizado `jato.sediles.dev` al Worker. Verifica que `/api/catalog` responde sin credenciales y que `/admin` sin sesión redirige a Access.

[Dominios personalizados](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [Validación de tokens de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) · [API de D1](https://developers.cloudflare.com/d1/worker-api/)
