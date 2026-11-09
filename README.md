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
- Perfiles editables por su propio titular con correo verificado; las fotos se guardan como enlaces HTTPS externos.
- Chat abierto para texto; compartir enlaces externos queda reservado a cuentas registradas con correo verificado (incluye al staff).
- Multimedia compartida mediante enlaces externos, sin almacenamiento ni costes de subida para el foro.

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

Las cuentas antiguas que se crearon con alias `@foro.local` no tienen una dirección real a la que enviar verificación o recuperación. Para publicar con la nueva versión, crea una cuenta nueva con tu correo real. Después, para volver a entrar, usa siempre **Entrar** con esa misma cuenta: no vuelvas a pulsar Registrarse. Firebase conserva la sesión en el navegador. Usa siempre `https://mantipobres.web.app/`; el dominio alternativo `foro-66dd5.web.app` puede guardar una sesión separada. El campo opcional **Invitación del staff** aparece tanto al registrarse como al iniciar sesión. Si se introduce durante el registro, se comprueba que el código esté disponible y se conserva solo su hash en la pestaña; el rol se concede cuando se verifica el correo. También puede pegarse al iniciar sesión después de verificar el correo.

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

Los invitados anónimos pueden enviar mensajes de texto en el chat, pero **no pueden** compartir enlaces. Compartir enlaces externos requiere una cuenta registrada y correo verificado. El staff también puede hacerlo porque sus invitaciones solo se activan después de verificar el correo.

Cada usuario puede editar únicamente su propio avatar. Los cambios de perfil también requieren correo verificado. Las reglas de Firestore aplican estos controles en el backend.

### Alojamiento externo

El foro no sube ni almacena archivos. Para compartir multimedia:

1. Abre [Catbox](https://catbox.moe/).
2. Sube el archivo y copia el enlace que devuelve.
3. Vuelve a MantiPobres y pega el enlace en el chat. Para el avatar, pega la URL directa en tu perfil.

Catbox indica un máximo de **200 MB por archivo**. Su FAQ dice que los archivos subidos de forma anónima se eliminan después de dos años sin accesos; los vinculados a una cuenta se conservan permanentemente. Catbox no publica una cuota total ilimitada garantizada. Revisa siempre sus [FAQ y condiciones](https://catbox.moe/faq.php), no subas documentos privados ni material que no tengas derecho a compartir y guarda una copia propia de lo importante.

Firebase Storage permanece desactivado (`STORAGE_ENABLED=false`), así que no hace falta activar Blaze. Los enlaces de imágenes, GIF, vídeos y documentos compatibles se muestran o abren desde el chat cuando la URL permite identificar el tipo de archivo.

### Publicar las reglas de Firestore

GitHub Actions publica Hosting, pero no actualiza las reglas de Firestore. Después de traer los cambios, ejecuta desde la carpeta del proyecto:

```cmd
firebase deploy --only firestore:rules --project foro-66dd5
```

El Owner se identifica por el UID configurado en `index.html` y `firestore.rules`. Para conservar tu administración, inicia sesión con la cuenta original usando **Entrar** (no crees una cuenta nueva cada vez) y visita siempre el mismo dominio del foro.

## Personalización

El nombre de marca está en `const NAME = "MantiPobres";` y en el título HTML. Los anuncios del staff y del proyecto destacado se editan directamente en `index.html`.
