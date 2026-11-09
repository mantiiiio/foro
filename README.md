# FORO.EXE — GitHub Pages + Firebase

Repositorio de foro retro estilo BBS/Usenet, con registro/login, perfiles, chat en vivo y subida opcional de archivos.

## Archivos
- `index.html`: sitio web.
- `firestore.rules`: reglas de base de datos.
- `storage.rules`: reglas de avatares y adjuntos.
- `.nojekyll`: configuración para GitHub Pages.

## GitHub Pages
1. Repositorio `mantiiiio/foro` → Settings → Pages.
2. Selecciona Deploy from a branch, branch `main`, folder `/(root)`.
3. URL esperada: https://mantiiiio.github.io/foro/
4. En Firebase Authentication → Settings → Authorized domains añade `mantiiiio.github.io`.

## Firebase básico
1. Crea un proyecto en https://console.firebase.google.com/ y registra una app web.
2. Copia `firebaseConfig` y reemplaza los valores de `const FB` en `index.html`.
3. Authentication → Sign-in method: activa Email/Password y Anonymous.
4. Crea Firestore Database y publica `firestore.rules`.
5. El registro usa un alias interno `usuario@foro.local`, no un correo real; no hay recuperación por email.

## Administrador
1. Registra tu cuenta de staff en el foro.
2. Firebase Authentication → Users: copia el UID.
3. En `index.html`, reemplaza `const ADMINS_UID = [];` por `const ADMINS_UID = ["TU_UID_REAL"];`.
4. Reemplaza `PEGA_AQUI_TU_UID_ADMIN` en `firestore.rules` y `storage.rules` con el mismo UID.
5. Publica las reglas actualizadas.

El UID no es una contraseña. Los permisos reales los verifican las reglas Firebase. Nunca pongas claves privadas ni tokens en el HTML.

## Fotos de perfil: imagen o GIF
El usuario puede cambiar y quitar su propia foto desde su perfil. JPG, PNG, GIF animado y WEBP, hasta 5 MB. Los avatares se muestran en perfiles, junto a temas y en los nuevos mensajes del chat.
1. Activa Firebase Cloud Storage y crea el bucket.
2. Vincula Blaze si Firebase lo requiere. Storage tiene cobro por uso; revisa precios y cuotas antes de habilitarlo.
3. Publica `storage.rules`, sustituyendo el UID de administrador.
4. En `index.html`, cambia `const STORAGE_ENABLED = false;` a `true`.
5. Verifica que `FB.storageBucket` coincida exactamente con el bucket de Firebase.

## Adjuntos en chat
- JPG, PNG, GIF, WEBP: hasta 8 MB.
- MP4, WEBM: hasta 25 MB.
Usan el mismo Storage. Los archivos tienen lectura pública para que otros usuarios puedan verlos; no subas material privado.

## Atajos
- Enter: enviar.
- Shift+Enter: nueva línea.
- Ctrl+Enter / Cmd+Enter: enviar.
- Alt+M: enfocar el cuadro de escritura.
- ?: abrir ayuda.
- Esc: cerrar ayuda o salir del chat ampliado.

## Seguridad
- GitHub Pages es hosting estático; Firebase aporta autenticación, base de datos y almacenamiento.
- Las reglas validan usuario, tipo MIME y tamaño. No realizan análisis antivirus del contenido.
- Los archivos subidos son públicos. No los uses para contenido privado o sensible.
- GitHub Pages no es un WAF ni una defensa anti-DDoS.
- Configura alertas de presupuesto antes de activar servicios facturados.

## Personalización
Edita el nombre en `const NAME = "FORO.EXE";` y en la cabecera HTML. Los anuncios se editan directamente en `index.html`.
