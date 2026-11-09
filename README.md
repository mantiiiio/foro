# MantiPobres — comunidad BBS / Usenet

MantiPobres es un foro retro en español alojado en Firebase Hosting, con cuentas, perfiles, categorías, temas, respuestas y chat en directo.

- Web pública: https://foro-66dd5.web.app/
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
- Adjuntos JPG/PNG/GIF/WEBP, vídeo MP4/WEBM y fotos de perfil preparados, pero desactivados hasta configurar Firebase Storage.

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

- `foro-66dd5.web.app`
- `foro-66dd5.firebaseapp.com`

## Registro y acceso

El registro pide un nombre de usuario (3–16 caracteres: letras, números o guion bajo), correo real y contraseña (mínimo 6 caracteres), y exige aceptar las reglas. Se envía un correo de verificación. Los usuarios deben verificarlo para publicar temas y respuestas. Se puede solicitar restablecer la contraseña desde la pantalla Entrar.

Las cuentas antiguas que se crearon con alias `@foro.local` no tienen una dirección real a la que enviar verificación o recuperación. Para publicar con la nueva versión, crea una cuenta nueva con tu correo real.

## Administrador

Los roles de administrador y moderador se configuran por UID; no se conceden por nombre de usuario ni por el contenido del navegador.

1. Registra la cuenta de administrador con un correo real y verifica el correo.
2. Firebase Console → Authentication → Users: copia el UID de esa cuenta.
3. En `index.html`, cambia `const ADMINS_UID = [];` por `const ADMINS_UID = ["UID_REAL"];`.
4. En `firestore.rules` (y en `storage.rules`, cuando se active Storage), sustituye `PEGA_AQUI_TU_UID_ADMIN` por el mismo UID.
5. Vuelve a desplegar: `firebase deploy --only hosting,firestore:rules`.

El UID no es una contraseña. Nunca guardes contraseñas, tokens privados ni claves de servicio en el HTML o en el repositorio.

## GitHub Actions

Para preparar despliegue automático, desde la carpeta del repositorio ejecuta:

```cmd
firebase init hosting:github
```

Selecciona `mantiiiio/foro` y la rama `main`. Firebase configurará el secreto de servicio y los workflows. No reemplaces `index.html` si el CLI pregunta si debe sobrescribirlo.

## Firebase Storage: fotos y archivos

El código incluye soporte para avatares JPG/PNG/GIF/WEBP (máximo 5 MB) y adjuntos del chat (imágenes hasta 8 MB, vídeos MP4/WEBM hasta 25 MB), pero `STORAGE_ENABLED` permanece en `false` de forma intencional.

Cloud Storage for Firebase requiere el plan Blaze para crear o utilizar buckets. Antes de activarlo, vincula una cuenta de facturación, elige una ubicación y configura alertas de presupuesto. Después crea el bucket, despliega `storage.rules`, comprueba que `FB.storageBucket` coincida con el bucket real y recién entonces cambia `STORAGE_ENABLED` a `true`.

Los adjuntos se sirven públicamente para que los participantes puedan verlos; no subas material privado o sensible. Las reglas validan la identidad, el tipo MIME y el tamaño, pero no analizan archivos en busca de malware.

## Personalización

El nombre de marca está en `const NAME = "MantiPobres";` y en el título HTML. Los anuncios del staff y del proyecto destacado se editan directamente en `index.html`.
