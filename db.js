const Firestore = require('@google-cloud/firestore');
const db = new Firestore();

const links = 'links', registry = 'linkRegistry';

module.exports = {
  getTargets,
  findSources,
  putLink,
  deleteLink,
  getLinkRegistry,
  obtainLinkRegistryId,
  deleteLinkRegistry
};

async function getTargets(source) {
  const doc = await db.collection(links).doc(source).get();
  return doc.exists ? doc.data().targets : [];
}

async function findSources(target) {
  const snapshot = await db.collection(links).where('targets', 'array-contains', target).get();
  const sources = [];
  snapshot.forEach(doc => sources.push(doc.id));
  return sources;
}

function putLink(source, target) {
  return db.runTransaction(async t => {
    const ref = db.collection(links).doc(source);
    const doc = await t.get(ref);
    if(doc.exists && doc.data().targets.includes(target)) {
      return false;
    }

    if(!doc.exists) {
      await t.set(ref, { targets: [target] });
    } else {
      await t.update(ref, {
        targets: Firestore.FieldValue.arrayUnion(target)
      });
    }
    return true;
  });
}

function deleteLink(source, target) {
  db.runTransaction(async t => {
    const ref = t.collection(links).doc(source);
    const doc = await t.get(ref);
    if(!doc.exists || !doc.data().targets.includes(target)) {
      return false;
    }

    if(doc.data().targets.length == 1) {
      await t.delete(ref);
    } else {
      await t.update(ref, {
        targets: Firestore.FieldValue.arrayRemove(target)
      });
    }
    return true;
  });
}

async function getLinkRegistry(linkId) {
  const doc = await db.collection(registry).doc(linkId).get();
  return doc.exists ? doc.data() : null;
}

async function obtainLinkRegistryId(chatId, isFromSource) {
  return await db.runTransaction(async t => {
    const ref = db.collection(registry)
      .where('chatId', '==', chatId)
      .where('isFromSource', '==', isFromSource)
      .limit(1);
    const snapshot = await t.get(ref);

    if(!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    const newRef = db.collection(registry).doc();
    t.set(newRef, { chatId, isFromSource });
    return newRef.id;
  });
}

function deleteLinkRegistry(linkId) {
  return db.collection(registry).doc(linkId).delete();
}
