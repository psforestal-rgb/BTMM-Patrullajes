(function () {
  const DB_NAME = 'patrullajes_sinac_v3';
  const DB_VERSION = 1;
  const PHOTO_STORE = 'photos';
  const META_STORE = 'meta';
  let dbPromise;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function withStore(storeName, mode, action) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = action(store);
      tx.oncomplete = () => resolve(request && request.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  window.PatrolStore = {
    photoPut(key, blob) { return withStore(PHOTO_STORE, 'readwrite', s => s.put(blob, key)); },
    photoGet(key) { return withStore(PHOTO_STORE, 'readonly', s => s.get(key)); },
    photoDelete(key) { return withStore(PHOTO_STORE, 'readwrite', s => s.delete(key)); },
    photoKeys() { return withStore(PHOTO_STORE, 'readonly', s => s.getAllKeys()); },
    metaPut(key, value) { return withStore(META_STORE, 'readwrite', s => s.put(value, key)); },
    metaGet(key) { return withStore(META_STORE, 'readonly', s => s.get(key)); }
  };
})();
