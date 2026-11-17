# Firebase App Check con Cloudflare Turnstile

Esta integración permite emitir tokens reales de Firebase App Check después de validar una prueba de Cloudflare Turnstile. Está pensada para Firebase Hosting y Cloudflare Workers Free.

**Estado inicial:** el código del Worker y el cliente se pueden publicar sin activar App Check. El cliente solo inicializa el proveedor cuando se configura `APP_CHECK_WORKER_URL` en `index.html`. No actives la aplicación forzosa en Firebase hasta completar las pruebas y revisar las métricas.

## 1. Crear el widget Turnstile

En Cloudflare, abre **Turnstile** y crea un widget de tipo **Managed**. Restringe los hostnames a los dominios reales del foro:

- `mantipobres.web.app`
- `foro-66dd5.web.app`
- `foro-66dd5.firebaseapp.com`

Guarda la **sitekey** y la **secret key**. La sitekey es pública; la secret key nunca debe publicarse.

## 2. Crear una cuenta de servicio de Google con permiso mínimo

En Google Cloud Console, selecciona el proyecto `foro-66dd5`.

1. En **IAM y administración → Cuentas de servicio**, crea una cuenta dedicada, por ejemplo `mantipobres-app-check`.
2. En **IAM y administración → Roles**, crea un rol personalizado que contenga únicamente el permiso `firebaseappcheck.tokens.mint`.
3. Asigna ese rol personalizado a la cuenta de servicio creada.
4. Comprueba que la **Firebase App Check API** (`firebaseappcheck.googleapis.com`) esté habilitada. No hace falta habilitar reCAPTCHA Enterprise para este proveedor.
5. Crea una clave JSON para esa cuenta de servicio. No subas el archivo JSON a GitHub, no lo envíes por chat y no lo guardes en el sitio web. Solo se usarán el correo `client_email` y la clave `private_key` como secretos del Worker.

No reutilices la cuenta de servicio principal que despliega Firebase Hosting. La cuenta dedicada reduce el impacto si una credencial llegara a filtrarse.

## 3. Crear el Cloudflare Worker

Crea un Worker llamado, por ejemplo, `mantipobres-appcheck`. Copia el contenido de `cloudflare/appcheck-turnstile-worker.js` en su editor y despliega el Worker.

En **Settings → Variables and Secrets**, configura:

**Variable de texto (no es secreta):**

- `TURNSTILE_SITE_KEY`: la sitekey pública del widget Turnstile.

**Secrets (valores privados):**

- `TURNSTILE_SECRET_KEY`: la secret key del widget Turnstile.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: el valor `client_email` del JSON de la cuenta dedicada.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: el valor `private_key` del JSON de la cuenta dedicada. Pégalo completo, incluyendo las líneas BEGIN/END.

Cloudflare debe guardar esos tres valores privados como **Secret**, no como variables de texto. Nunca los agregues al repositorio.

El Worker usa el dominio `workers.dev`. Su URL tendrá una forma similar a:

`https://mantipobres-appcheck.TU-SUBDOMINIO.workers.dev`

Prueba la ruta `/config` desde el navegador. Debe devolver un JSON con `siteKey`. No debe mostrar la secret key ni ningún dato de la cuenta de servicio.

## 4. Conectar el sitio al Worker

En `index.html`, busca:

```js
const APP_CHECK_WORKER_URL = "";
```

Cuando el Worker esté desplegado y `/config` responda correctamente, coloca allí la URL base HTTPS del Worker, sin `/token` ni `/config`, por ejemplo:

```js
const APP_CHECK_WORKER_URL = "https://mantipobres-appcheck.TU-SUBDOMINIO.workers.dev";
```

Guarda el cambio en GitHub. El workflow del foro recalcula el hash SHA-256 de la política CSP durante el despliegue. La política ya permite el script y el iframe de Turnstile y las solicitudes al dominio `workers.dev`.

## 5. Comprobar antes de exigir App Check

1. Abre el foro y revisa la consola del navegador: no debe haber errores de CSP, Turnstile ni de emisión de App Check.
2. Comprueba en Firebase Console → App Check → Métricas que las solicitudes legítimas estén llegando como verificadas.
3. Prueba navegación, inicio de sesión, sesión anónima, lectura y escritura de temas y respuestas.
4. Solo después de verificar las métricas y probar con varios navegadores, activa la aplicación forzosa para **Cloud Firestore**. No actives Storage: este proyecto tiene Firebase Storage deshabilitado.

La clave privada de Google debe permanecer exclusivamente en los Secrets del Worker. La sitekey de Turnstile puede ser pública. La verificación del lado del servidor mediante Siteverify es obligatoria: el navegador por sí solo no puede validar una respuesta Turnstile.

## Límites y alcance

- Turnstile añade una barrera contra bots, no vuelve imposible el abuso ni sustituye las reglas de Firestore.
- El Worker emite un token App Check para el identificador web de Firebase de este foro.
- Firebase sigue siendo quien firma y devuelve el token App Check final.
- La integración no activa enforcement automáticamente. Ese paso se deja manual para evitar bloquear a usuarios legítimos.
