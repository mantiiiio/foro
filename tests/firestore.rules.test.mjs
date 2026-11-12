import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";

const PROJECT_ID = "demo-mantipobres-rules";
const OWNER_UID = "YgTAVFNclBgScVybW82xE0jKJg32";
let testEnv;

function account(uid, { verified = true, provider = "password" } = {}) {
  return testEnv.authenticatedContext(uid, {
    email: uid + "@gmail.com",
    email_verified: verified,
    firebase: { sign_in_provider: provider }
  }).firestore();
}

async function seed(documents) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [path, data] of Object.entries(documents)) {
      await writeBatch(db).set(doc(db, path), data).commit();
    }
  });
}

before(async () => {
  const rules = await readFile("firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test("visitas anónimas pueden leer temas y comentarios visibles, pero no contenido oculto ni datos privados", async () => {
  await seed({
    "topics/topic-public": {
      b: "gen", t: "Tema público", u: "alice", uid: "alice",
      ts: 1, lr: 1, lu: "alice", n: 0,
      staffBadge: false, lastStaffBadge: false,
      moderationHidden: false, moderationHiddenUntil: null
    },
    "topics/topic-hidden": {
      b: "gen", t: "Tema oculto", u: "alice", uid: "alice",
      ts: 2, lr: 2, lu: "alice", n: 0,
      staffBadge: false, lastStaffBadge: false,
      moderationHidden: true, moderationHiddenUntil: null
    },
    "posts/post-public": {
      tp: "topic-public", uid: "alice", u: "alice",
      x: "Respuesta pública", ts: 3, staffBadge: false,
      moderationHidden: false, moderationHiddenUntil: null
    },
    "posts/post-hidden": {
      tp: "topic-public", uid: "alice", u: "alice",
      x: "Respuesta oculta", ts: 4, staffBadge: false,
      moderationHidden: true, moderationHiddenUntil: null
    },
    "users/alice": { u: "alice", ts: 1 },
    "topics/topic-public/ratings/vote-1": { uid: "alice", stars: 5, ts: 1 }
  });

  const guest = account("guest", { provider: "anonymous" });
  const publicTopics = query(collection(guest, "topics"), where("moderationHidden", "==", false));
  const publicPosts = query(collection(guest, "posts"), where("moderationHidden", "==", false));

  await assertSucceeds(getDoc(doc(guest, "topics", "topic-public")));
  await assertSucceeds(getDocs(publicTopics));
  await assertFails(getDoc(doc(guest, "topics", "topic-hidden")));
  await assertFails(getDocs(collection(guest, "topics")));
  await assertSucceeds(getDocs(publicPosts));
  await assertFails(getDocs(collection(guest, "posts")));
  await assertFails(getDoc(doc(guest, "posts", "post-hidden")));
  await assertFails(getDoc(doc(guest, "users", "alice")));
  await assertFails(getDoc(doc(guest, "topics", "topic-public", "ratings", "vote-1")));

  const topicWrite = {
    b: "gen", t: "No debe publicarse", u: "guest", uid: "guest",
    ts: 5, lr: 5, lu: "guest", n: 0,
    staffBadge: false, lastStaffBadge: false,
    moderationHidden: false, moderationHiddenUntil: null
  };
  await assertFails(setDoc(doc(guest, "topics", "guest-topic"), topicWrite));
  await assertFails(setDoc(doc(guest, "posts", "guest-post"), {
    tp: "topic-public", u: "guest", uid: "guest",
    x: "No debe publicarse", ts: 6, staffBadge: false,
    moderationHidden: false, moderationHiddenUntil: null
  }));
});

test("una cuenta sin verificar puede leer el foro, pero no crear temas ni respuestas", async () => {
  await seed({
    "topics/topic-1": {
      b: "gen", t: "Tema público", u: "owner", uid: "owner",
      ts: 1, lr: 1, lu: "owner", n: 0,
      staffBadge: false, lastStaffBadge: false,
      moderationHidden: false, moderationHiddenUntil: null
    },
    "users/alice": { u: "alice", ts: 1, rulesAcceptedAt: 1 }
  });

  const unverified = account("alice", { verified: false });
  await assertSucceeds(getDoc(doc(unverified, "topics", "topic-1")));
  await assertFails(setDoc(doc(unverified, "topics", "unverified-topic"), {
    b: "gen", t: "No debe publicarse", u: "alice", uid: "alice",
    ts: 2, lr: 2, lu: "alice", n: 0,
    staffBadge: false, lastStaffBadge: false,
    moderationHidden: false, moderationHiddenUntil: null
  }));
  await assertFails(setDoc(doc(unverified, "posts", "unverified-post"), {
    tp: "topic-1", u: "alice", uid: "alice",
    x: "No debe publicarse", ts: 2, staffBadge: false,
    moderationHidden: false, moderationHiddenUntil: null
  }));
});

test("un moderador puede editar el texto, pero no apropiarse del UID de una respuesta", async () => {
  await seed({
    "staff/mod-1": { role: "moderator" },
    "posts/post-1": {
      tp: "topic-1", uid: "author", u: "author",
      x: "Texto original", ts: 1, staffBadge: false
    }
  });

  const moderator = account("mod-1");
  const postRef = doc(moderator, "posts", "post-1");

  await assertFails(updateDoc(postRef, { uid: "mod-1" }));
  await assertFails(updateDoc(postRef, { staffBadge: true, uid: "mod-1" }));
  await assertSucceeds(updateDoc(postRef, { x: "Texto revisado por moderación" }));
});

test("solo se pueden crear temas en categorías publicadas", async () => {
  await seed({
    "users/alice": { u: "alice", ts: 1, rulesAcceptedAt: 1 }
  });

  const alice = account("alice");
  const valid = {
    b: "gen", t: "Tema válido", u: "alice", uid: "alice",
    ts: 2, lr: 2, lu: "alice", n: 0,
    staffBadge: false, lastStaffBadge: false,
    moderationHidden: false, moderationHiddenUntil: null
  };

  await assertSucceeds(setDoc(doc(alice, "topics", "valid-topic"), valid));
  await assertFails(setDoc(doc(alice, "topics", "hidden-board-topic"), {
    ...valid,
    b: "categoria-inventada"
  }));
});

test("solo el OWNER puede crear temas en Avisos del Staff y Nuevo proyecto", async () => {
  await seed({
    [`users/${OWNER_UID}`]: { u: "propietario", ts: 1, rulesAcceptedAt: 1 },
    "users/alice": { u: "alice", ts: 1, rulesAcceptedAt: 1 },
    "users/admin-1": { u: "admin", ts: 1, rulesAcceptedAt: 1 },
    "staff/admin-1": { role: "admin" }
  });

  const owner = account(OWNER_UID);
  const alice = account("alice");
  const admin = account("admin-1");

  function topicPayload(board, uid, username, staffBadge) {
    return {
      b: board, t: "Publicación oficial", u: username, uid,
      ts: 2, lr: 2, lu: username, n: 0,
      staffBadge, lastStaffBadge: staffBadge,
      moderationHidden: false, moderationHiddenUntil: null
    };
  }

  for (const board of ["avisos", "proyecto"]) {
    await assertSucceeds(setDoc(
      doc(owner, "topics", "owner-" + board),
      topicPayload(board, OWNER_UID, "propietario", true)
    ));
    await assertFails(setDoc(
      doc(alice, "topics", "member-" + board),
      topicPayload(board, "alice", "alice", false)
    ));
    await assertFails(setDoc(
      doc(admin, "topics", "admin-" + board),
      topicPayload(board, "admin-1", "admin", true)
    ));
  }
});


test("el chat online está retirado y solo el OWNER puede purgar mensajes antiguos", async () => {
  await seed({
    "chatMessages/legacy-message": {
      uid: "alice", u: "alice", x: "Mensaje antiguo", ts: 1,
      avatarUrl: "", staffBadge: false, media: null
    }
  });

  const owner = account(OWNER_UID);
  const alice = account("alice");

  await assertSucceeds(getDocs(collection(owner, "chatMessages")));
  await assertSucceeds(getDoc(doc(owner, "chatMessages", "legacy-message")));
  await assertFails(getDocs(collection(alice, "chatMessages")));
  await assertFails(getDoc(doc(alice, "chatMessages", "legacy-message")));
  await assertFails(setDoc(doc(alice, "chatMessages", "new-message"), {
    uid: "alice", u: "alice", x: "No debe publicarse", ts: 2,
    avatarUrl: "", staffBadge: false, media: null
  }));
  await assertFails(updateDoc(doc(owner, "chatMessages", "legacy-message"), { x: "No editable" }));
  await assertSucceeds(deleteDoc(doc(owner, "chatMessages", "legacy-message")));
});
test("el contador solo aumenta cuando se crea una respuesta real en la misma operación", async () => {
  await seed({
    "users/alice": { u: "alice", ts: 1, rulesAcceptedAt: 1 },
    "topics/topic-1": {
      b: "gen", t: "Tema", u: "owner", uid: "owner",
      ts: 1, lr: 1, lu: "owner", n: 0,
      staffBadge: false, lastStaffBadge: false
    }
  });

  const alice = account("alice");
  const topicRef = doc(alice, "topics", "topic-1");

  await assertFails(updateDoc(topicRef, {
    lr: 2, lu: "alice", n: 1, lastStaffBadge: false,
    lastCreatedPostId: "respuesta-inexistente"
  }));

  const batch = writeBatch(alice);
  batch.set(doc(alice, "userRateLimits", "alice"), {
    lastPostAt: serverTimestamp(),
    lastPostId: "reply-1"
  });
  batch.set(doc(alice, "posts", "reply-1"), {
    tp: "topic-1", u: "alice", uid: "alice",
    x: "Respuesta real", ts: 2, staffBadge: false,
    moderationHidden: false, moderationHiddenUntil: null
  });
  batch.update(topicRef, {
    lr: 2, lu: "alice", n: 1, lastStaffBadge: false,
    lastCreatedPostId: "reply-1"
  });

  await assertSucceeds(batch.commit());
});

test("el contador solo disminuye al eliminar la respuesta correspondiente", async () => {
  await seed({
    "topics/topic-1": {
      b: "gen", t: "Tema", u: "owner", uid: "owner",
      ts: 1, lr: 2, lu: "alice", n: 1,
      staffBadge: false, lastStaffBadge: false
    },
    "posts/reply-1": {
      tp: "topic-1", uid: "alice", u: "alice",
      x: "Comentario", ts: 2, staffBadge: false
    }
  });

  const alice = account("alice");
  const topicRef = doc(alice, "topics", "topic-1");
  const postRef = doc(alice, "posts", "reply-1");

  await assertFails(updateDoc(topicRef, {
    n: 0, lastDeletedPostId: "reply-1"
  }));

  await assertSucceeds(runTransaction(alice, async transaction => {
    const post = await transaction.get(postRef);
    const topic = await transaction.get(topicRef);
    if (!post.exists() || !topic.exists()) throw new Error("Faltan documentos de prueba.");

    transaction.update(postRef, {
      x: "",
      deleted: true,
      deletedBy: "usuario",
      deletedByUid: "alice",
      deletedAt: 3,
      deletedQuoteHash: "abc"
    });
    transaction.update(topicRef, {
      n: topic.data().n - 1,
      lastDeletedPostId: "reply-1"
    });
  }));
});

test("una cuenta baneada solo puede leer y ocultar su propio contenido; no puede borrarlo", async () => {
  await seed({
    "moderation/banned": { status: "permanent" },
    "posts/own-post": {
      tp: "topic-1", uid: "banned", u: "banned",
      x: "Mi publicación", ts: 1, staffBadge: false
    },
    "posts/other-post": {
      tp: "topic-1", uid: "other", u: "other",
      x: "Publicación ajena", ts: 2, staffBadge: false
    },
  });

  const banned = account("banned");
  const ownPosts = query(collection(banned, "posts"), where("uid", "==", "banned"));

  await assertSucceeds(getDocs(ownPosts));
  await assertFails(getDoc(doc(banned, "posts", "other-post")));
  await assertFails(updateDoc(doc(banned, "posts", "own-post"), {
    x: "", deleted: true, deletedBy: "usuario",
    deletedByUid: "banned", deletedAt: 4, deletedQuoteHash: "abc"
  }));

  await assertSucceeds(updateDoc(doc(banned, "posts", "own-post"), {
    moderationHidden: true,
    moderationHiddenUntil: null
  }));
});

test("el staff suspendido solo puede consultar su propio expediente de moderación", async () => {
  await seed({
    "staff/suspended-admin": { role: "admin" },
    "moderation/suspended-admin": { status: "permanent" },
    "moderation/target": { status: "active" }
  });

  const suspendedAdmin = account("suspended-admin");

  await assertSucceeds(getDoc(doc(suspendedAdmin, "moderation", "suspended-admin")));
  await assertFails(getDoc(doc(suspendedAdmin, "moderation", "target")));
  await assertFails(getDocs(collection(suspendedAdmin, "moderation")));
});

test("un administrador suspendido no puede borrar perfiles ni retirar roles", async () => {
  await seed({
    "staff/suspended-admin": { role: "admin" },
    "staff/mod-2": { role: "moderator" },
    "moderation/suspended-admin": { status: "permanent" },
    "users/victim": { u: "victim", ts: 1, rulesAcceptedAt: 1 }
  });

  const suspendedAdmin = account("suspended-admin");

  await assertFails(deleteDoc(doc(suspendedAdmin, "users", "victim")));
  await assertFails(deleteDoc(doc(suspendedAdmin, "staff", "mod-2")));
  await assertFails(getDoc(doc(suspendedAdmin, "staff", "mod-2")));
});
