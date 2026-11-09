# MantiPobres — comunidad BBS / Usenet

MantiPobres es un foro retro en español alojado en Firebase Hosting, con cuentas, perfiles, categorías, temas, respuestas y chat en directo.

- Web pública: https://mantipobres.web.app/
- Repositorio: https://github.com/mantiiiio/foro
- Firebase Project ID: `foro-66dd5`

## Funciones

- Registro con nombre de usuario único, correo real y contraseña.
- Verificación por correo y recuperación de contraseña.
- Invitados anónimos en el chat.
- Categorías, temas y respuestas; el foro de reglas es de solo lectura para miembros.
- Perfiles, rangos y contador de mensajes.
- Chat en tiempo real con mensajes de texto y borrado de mensajes propios.
- Herramientas de administración por UID.
- Anuncios y panel lateral editables directamente en `index.html`.
- Perfiles editables por su propio titular con correo verificado; fotos mediante enlace HTTPS o subida con ImageKit al configurarlo.
- Chat abierto para texto, pero los enlaces y adjuntos quedan reservados a cuentas registradas con correo verificado (incluye al staff).
- Adjuntos preparados para ImageKit: imágenes, GIF, vídeos, PDF, TXT, CSV y ZIP, con límites por archivo.

## Configuración y despliegue

El proyecto Firebase ya está asociado en `.firebaserc`. Instala Node.js LTS, Git y Firebase CLI. Desde la carpeta clonada:

```cmd
firebase login
firebase use foro-66dd5
firebase deploy --only auth,firestore,hosting
```

La configuración de `firebase.json` habilita Email/Password y Anonymous y vincula `firestore.rules`. Antes de desplegar reglas, crea la base de datos Cloud Firestore (modo Production) en Firebase Console si todavía no existe.

### Dominios autorizados

En Firebase Console → Authentication → Settings → Authorized domains, comprueba que estén autorizados:

- `mantipobres.web.app`
- `foro-66dd5.web.app` (dirección alternativa)
- `foro-66dd5.firebaseapp.com`

## Registro y acceso

El registro pide un nombre de usuario (3–16 caracteres: letras, números o guion bajo), correo real y contraseña (mínimo 6 caracteres), y exige aceptar las reglas. Se envía un correo de verificación. Los usuarios deben verificarlo para publicar temas y respuestas. Se puede solicitar restablecer la contraseña desde la pantalla Entrar.

Las cuentas antiguas que se crearon con alias `@foro.local` no tienen una dirección real a la que enviar verificación o recuperación. Para publicar con la nueva versión, crea una cuenta nueva con tu correo real. El campo opcional **Invitación del staff** aparece tanto al registrarse como al iniciar sesión. Si se introduce durante el registro, se comprueba que el código esté disponible y se conserva solo su hash en la pestaña; el rol se concede cuando se verifica el correo. También puede pegarse al iniciar sesión después de verificar el correo.

## Personal y roles administrativos

Los roles no se conceden por nombre de usuario ni por texto del navegador. El primer propietario se configura con su UID real, tanto en `index.html` como en `firestore.rules`. No se puede crear un propietario mediante un token.

- **Propietario:** control total; puede emitir invitaciones para co-owner, administrador, moderador y ayudante.
- **Co-owner / Administrador:** pueden gestionar el personal y emitir invitaciones para moderadores y ayudantes.
- **Moderador:** puede moderar temas y respuestas; no puede elevarse de rol ni emitir invitaciones.
- **Ayudante:** distintivo de personal sin permisos de moderación.

Solo el propietario/co-owner/administrador ve el apartado **Administración**. El generador requiere elegir el rol y describir el propósito de cada invitación. Los tokens se generan con aleatoriedad criptográfica, se guarda únicamente SHA-256, vencen a los 7 días y se pueden usar una sola vez. Al reclamarse, el token queda bloqueado permanentemente y el rol se vincula al UID de Firebase. El titular debe usar una cuenta cuyo correo esté verificado. **Owner no es un rol emitible por token**: existe un único propietario y se configura directamente por UID. El token anterior de verificación genérica quedó retirado y no es válido para este sistema.

El propietario único ya está configurado por UID en `index.html`, `firestore.rules` y `storage.rules`. Si alguna vez cambias la cuenta propietaria, actualiza el mismo UID en los tres archivos y vuelve a desplegar las reglas correspondientes. El UID no es una contraseña. Nunca guardes contraseñas, tokens privados ni claves de servicio en el HTML o en el repositorio.

## GitHub Actions

Los workflows ya están creados en `.github/workflows/` y esperan el secreto privado `FIREBASE_SERVICE_ACCOUNT_FORO_66DD5`. Para que Firebase CLI cree la cuenta de servicio y cargue el secreto en GitHub:

```cmd
firebase init hosting:github
```

Selecciona `mantiiiio/foro` y la rama `main`. Si pregunta si debe sobrescribir los archivos YAML de workflows ya existentes, puedes aceptar; no reemplaces `index.html`. El CLI creará la cuenta de servicio, guardará su clave como secreto y escribirá los workflows correspondientes. Después, un push a `main` desplegará Hosting y los pull requests tendrán una URL de vista previa. El primer despliegue de Authentication y Firestore se hace desde tu CMD con `firebase deploy --only auth,firestore,hosting`; el workflow automático publica Hosting.

## Multimedia y permisos

Los invitados anónimos pueden enviar mensajes de texto en el chat, pero **no pueden** compartir enlaces, imágenes, vídeos ni archivos. Esas acciones requieren una cuenta registrada y correo verificado. El staff también puede hacerlo porque sus invitaciones solo se activan después de verificar el correo.

Cada usuario puede editar únicamente su propio avatar. Los cambios de perfil también requieren correo verificado. Las reglas de Firestore aplican estos controles en el backend; no dependen solamente de ocultar botones en la página.

### Almacenamiento

Firebase Storage permanece desactivado (STORAGE_ENABLED=false) para evitar activar el plan Blaze. Las subidas se prepararon para ImageKit, pero no estarán activas hasta configurar las claves y el Worker de autenticación. Los límites de la interfaz son:

- Avatar: JPG, PNG, GIF o WEBP, máximo 5 MB.
- Chat: JPG, PNG, GIF o WEBP, máximo 8 MB.
- Vídeo: MP4 o WEBM, máximo 25 MB.
- Documentos: PDF, TXT, CSV o ZIP, máximo 10 MB.

Los enlaces HTTPS pueden compartirse en mensajes del chat por cuentas verificadas. Los enlaces directos a imágenes, GIF y vídeos muestran vista previa; los enlaces a documentos conocidos muestran un enlace para abrir el archivo. El foro no aloja el contenido de enlaces externos.

### Activar subidas directas con ImageKit

1. Crea una cuenta en https://imagekit.io/ y abre Developer options / API keys. Copia tu public key y private key. La private key nunca debe ponerse en el HTML, en GitHub ni compartirse por chat.
2. En https://dash.cloudflare.com/, abre Workers & Pages y crea un Worker. Pega el contenido completo de cloudflare/imagekit-auth-worker.js y publícalo.
3. En la configuración del Worker, abre Settings → Variables and Secrets y crea estas tres variables:
   - FIREBASE_WEB_API_KEY: la Web API Key que aparece en la configuración de tu app web de Firebase.
   - IMAGEKIT_PUBLIC_KEY: la public key de ImageKit.
   - IMAGEKIT_PRIVATE_KEY: la private key de ImageKit, guardada como Secret (no como texto público).
4. Vuelve a publicar el Worker. Su dirección será parecida a https://nombre-del-worker.tu-cuenta.workers.dev. El endpoint que usará el foro es esa dirección seguida por /auth.
5. En index.html, completa estas dos constantes con tus valores públicos:
   ```js
   const IMAGEKIT_AUTH_ENDPOINT = "https://nombre-del-worker.tu-cuenta.workers.dev/auth";
   const IMAGEKIT_PUBLIC_KEY = "public_TU_CLAVE";
   ```
6. Guarda y publica el cambio en GitHub. Al cargar el foro, los botones de adjuntar se habilitarán automáticamente.

El Worker consulta a Firebase para verificar que la cuenta tenga una sesión válida y correo confirmado. Solo entonces genera una firma de corta duración para ImageKit. La clave privada permanece en Cloudflare. ImageKit exige que las firmas se generen en el servidor y que no se exponga la private key en el navegador (documentación: https://imagekit.io/docs/integration/javascript).

Cloudflare Workers Free tiene una cuota de 100.000 solicitudes por día y 10 ms de CPU por solicitud, según sus límites publicados en octubre de 2026 (https://developers.cloudflare.com/workers/platform/limits/). ImageKit también tiene cuotas gratuitas y límites propios: no es almacenamiento ilimitado. Revisa el consumo desde su panel y no subas material sensible. No actives Firebase Storage ni Blaze para seguir esta guía.

## Personalización

El nombre de marca está en `const NAME = "MantiPobres";` y en el título HTML. Los anuncios del staff y del proyecto destacado se editan directamente en `index.html`.
