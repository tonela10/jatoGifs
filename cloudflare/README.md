# Catálogo en Cloudflare

El Worker `jatogifs-catalog` sirve `jato.sediles.dev`. Guarda en D1 únicamente los ID de GIPHY en orden de incorporación, hasta 100.

| Ruta | Acceso | Uso |
| --- | --- | --- |
| `/` | Público | Ver y añadir GIF |
| `/admin` | Público | Redirige a la web |
| `/manage` | Cloudflare Access | Quitar GIF |
| `/api/catalog` | Lectura pública | Devuelve `{"version":1,"ids":[...]}` |

La extensión lee una lista nueva cada vez que abres el selector. Los IDs de la lista se conservan en memoria de sesión para mantener estables las páginas de un selector ya abierto. El Worker y D1 no necesitan la clave de GIPHY. Desde la extensión 1.3.0 el navegador carga los enlaces públicos de imagen; la 1.2.1 sigue siendo compatible con el catálogo y usa la clave de esa instalación. El formulario público valida el formato y comprueba que GIPHY permita incrustar el GIF. Se limitan los intentos por dirección IP sin guardarla en D1. La extensión marca el GIF como no disponible si fallan la miniatura y la imagen original.

## Despliegue

1. Crea una base D1 y aplica `migrations/0001_catalog.sql` una sola vez. La migración incluye los nueve GIF de la versión 1.1.1. Si vuelves a ejecutar la migración, se volverían a añadir GIF iniciales que ya se hayan quitado.
2. Configura una aplicación de Cloudflare Access de tipo self-hosted para `jato.sediles.dev/manage`, con una política Allow para el correo propietario. Usa el proveedor de códigos de un solo uso existente. No protejas `/api/catalog` con esta política.
3. Sube `worker.mjs` como módulo principal y `access.mjs` y `admin.mjs` como módulos auxiliares, con el binding D1 `CATALOG_DB` y un binding de límites `ADD_RATE_LIMIT` (cuatro intentos por minuto por clave). Configura en Cloudflare `ACCESS_ISSUER` (URL HTTPS del equipo Access), `ACCESS_AUD` (audiencia de la aplicación) y `ADMIN_EMAIL` (correo permitido).
4. Asocia el dominio personalizado `jato.sediles.dev` al Worker. Verifica que `/api/catalog` responde sin credenciales y que el formulario acepta envíos públicos y que `/manage` sin sesión redirige a Access.

[Dominios personalizados](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [Validación de tokens de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) · [API de D1](https://developers.cloudflare.com/d1/worker-api/)
