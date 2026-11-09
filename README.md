# MantiPobres — comunidad BBS / Usenet

MantiPobres es un foro retro en español alojado en Firebase Hosting, con cuentas, perfiles, categorías, temas, respuestas y chat en directo.

- Web pública: https://mantipobres.web.app/
- Repositorio: https://github.com/mantiiiio/foro
- Firebase Project ID: `foro-66dd5`

## Funciones

- Registro con nombre de usuario único, correo real y contraseña.
- Verificación por correo y recuperación de contraseña.
- Invitados anónimos en el chat.
- Categorías, temas y respuestas/comentarios; cada tema tiene valoración de 1 a 5 estrellas por cuenta registrada.
- Al volver a cargar una página se conserva la sección, el tema abierto y la posición de lectura; el inicio muestra los temas recientes.
- Perfiles, rangos y contador de mensajes.
- Chat en tiempo real con mensajes de texto y borrado de mensajes propios.
- Herramientas de administración por UID.
- Anuncios y panel lateral editables directamente en `index.html`.
- Cada cuenta registrada puede editar su propio avatar inmediatamente después de iniciar sesión; las fotos se guardan como enlaces HTTPS externos.
- Invitados anónimos: chat de texto. Cualquier cuenta registrada puede compartir enlaces y archivos aunque todavía no haya verificado el correo.
- La verificación del correo sigue siendo obligatoria para publicar temas y respuestas en los foros.
- Los archivos se suben desde el selector integrado del foro a Catbox; no se activa Firebase Storage ni se necesita un plan de pago.

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

Los invitados anónimos pueden enviar mensajes de texto en el chat, pero **no pueden** compartir enlaces. Cualquier cuenta registrada con sesión iniciada puede compartir enlaces y subir archivos, incluso antes de verificar el correo. La verificación sigue siendo obligatoria para crear temas y respuestas. El staff también puede usar estas funciones desde su sesión.

Cada usuario puede editar únicamente su propio avatar y puede hacerlo apenas inicia sesión. Cada cuenta registrada puede puntuar un tema con 1–5 estrellas y modificar su voto. Las respuestas dentro de cada tema son sus comentarios. Las reglas de Firestore protegen los votos por UID.

### Alojamiento externo

El foro no sube ni almacena archivos. Para compartir multimedia desde el foro:

1. Inicia sesión con tu cuenta.
2. En el chat, pulsa **Adjuntar archivo**, selecciona un archivo y pulsa **Subir archivo**. También encontrarás un selector en Configuración y en el editor de tu avatar.
3. El formulario envía el archivo directamente a la API de Catbox y abre otra pestaña con la URL que devuelve. Copia esa URL y pégala en el chat; para el avatar, pégala en el campo de URL del perfil y pulsa **Guardar URL**.
4. Los enlaces de imágenes y vídeos se previsualizan en el chat; los documentos aparecen como enlaces para abrir.

La carga usa un formulario HTML normal, así que no depende de permisos CORS ni de claves privadas en el navegador. Catbox indica un máximo de **200 MB por archivo**. Su FAQ dice que los archivos subidos de forma anónima se eliminan después de dos años sin accesos; los vinculados a una cuenta se conservan permanentemente. Catbox no publica una cuota total ilimitada garantizada. Revisa siempre sus [FAQ y condiciones](https://catbox.moe/faq.php), no subas documentos privados ni material que no tengas derecho a compartir y guarda una copia propia de lo importante.

Firebase Storage permanece desactivado (`STORAGE_ENABLED=false`), así que no hace falta activar Blaze. Los enlaces de imágenes, GIF, vídeos y documentos compatibles se muestran o abren desde el chat cuando la URL permite identificar el tipo de archivo.

### Publicar las reglas de Firestore

GitHub Actions publica Hosting, pero no actualiza las reglas de Firestore. Después de traer los cambios, ejecuta desde la carpeta del proyecto:

```cmd
firebase deploy --only firestore:rules --project foro-66dd5
```

El Owner se identifica por el UID configurado en `index.html` y `firestore.rules`. Para conservar tu administración, inicia sesión con la cuenta original usando **Entrar** (no crees una cuenta nueva cada vez) y visita siempre el mismo dominio del foro.

## Personalización

El nombre de marca está en `const NAME = "MantiPobres";` y en el título HTML. Los anuncios del staff y del proyecto destacado se editan directamente en `index.html`.
