import { after, before, beforeEach, test } from "node:test";
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

test("las sesiones anónimas no pueden leer temas", async () => {
  await seed({
    "topics/topic-1": {
      b: "gen", t: "Tema privado", u: "alice", uid: "alice",
      ts: 1, lr: 1, lu: "alice", n: 0,
      staffBadge: false, lastStaffBadge: false
    }
  });

  const guest = account("guest", { provider: "anonymous" });
  await assertFails(getDoc(doc(guest, "topics", "topic-1")));
  await assertFails(getDocs(collection(guest, "topics")));
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
    staffBadge: false, lastStaffBadge: false
  };

  await assertSucceeds(setDoc(doc(alice, "topics", "valid-topic"), valid));
  await assertFails(setDoc(doc(alice, "topics", "hidden-board-topic"), {
    ...valid,
    b: "categoria-inventada"
  }));
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
    x: "Respuesta real", ts: 2, staffBadge: false
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
    "chatMessages/own-message": {
      uid: "banned", u: "banned", x: "Mensaje", ts: 1,
      avatarUrl: "", staffBadge: false, media: null
    }
  });

  const banned = account("banned");
  const ownPosts = query(collection(banned, "posts"), where("uid", "==", "banned"));

  await assertSucceeds(getDocs(ownPosts));
  await assertFails(getDoc(doc(banned, "posts", "other-post")));
  await assertFails(updateDoc(doc(banned, "posts", "own-post"), {
    x: "", deleted: true, deletedBy: "usuario",
    deletedByUid: "banned", deletedAt: 4, deletedQuoteHash: "abc"
  }));
  await assertFails(deleteDoc(doc(banned, "chatMessages", "own-message")));

  await assertSucceeds(updateDoc(doc(banned, "posts", "own-post"), {
    moderationHidden: true,
    moderationHiddenUntil: null
  }));
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
