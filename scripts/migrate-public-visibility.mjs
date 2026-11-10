import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "foro-66dd5";
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const migrationMarker = db.collection("systemMigrations").doc("publicForumVisibilityV1");

async function migrateCollection(name) {
  const snapshot = await db.collection(name).get();
  let batch = db.batch();
  let writes = 0;
  let updated = 0;

  async function flush() {
    if (!writes) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  }

  for (const document of snapshot.docs) {
    const data = document.data();
    const patch = {};
    const hidden = data.moderationHidden === true;
    const rawUntil = data.moderationHiddenUntil;
    const untilMs = rawUntil?.toMillis
      ? rawUntil.toMillis()
      : rawUntil == null
        ? null
        : new Date(rawUntil).getTime();

    if (!Object.prototype.hasOwnProperty.call(data, "moderationHidden")) {
      patch.moderationHidden = false;
    } else if (hidden && rawUntil != null && Number.isFinite(untilMs) && untilMs <= Date.now()) {
      // A temporary hide expired. Restore visibility, but leave permanent hides untouched.
      patch.moderationHidden = false;
    }

    if (!Object.prototype.hasOwnProperty.call(data, "moderationHiddenUntil") || patch.moderationHidden === false) {
      patch.moderationHiddenUntil = null;
    }

    if (Object.keys(patch).length) {
      batch.update(document.ref, patch);
      writes++;
      updated++;
      if (writes >= 400) await flush();
    }
  }

  await flush();
  process.stdout.write(`${name}: ${snapshot.size} documentos revisados; ${updated} actualizados.\\n`);
}

const markerSnapshot = await migrationMarker.get();
if (markerSnapshot.exists && markerSnapshot.data()?.complete === true) {
  process.stdout.write("La migración de visibilidad pública ya se completó; no hay documentos que revisar.\\n");
} else {
  await migrateCollection("topics");
  await migrateCollection("posts");
  await migrationMarker.set({
    version: 1,
    complete: true,
    completedAt: new Date()
  });
  process.stdout.write("Migración de visibilidad pública completada.\\n");
}
