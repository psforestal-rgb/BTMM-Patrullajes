// Almacenamiento offline: IndexedDB para fotografías y mapa base descargado.
(function () {
  const DB_NAME = 'patrullajes_sinac_v4';
  const DB_VERSION = 1;
  const STORE = 'blobs';
  let dbPromise;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function withStore(mode, action) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = action(store);
      tx.oncomplete = () => resolve(request && request.result !== undefined ? request.result : request);
      tx.onerror = () => reject(tx.error);
    });
  }

  window.PatrolStore = {
    put(key, blob) { return withStore('readwrite', s => s.put(blob, key)); },
    get(key) { return withStore('readonly', s => s.get(key)); },
    del(key) { return withStore('readwrite', s => s.delete(key)); },
    keys() { return withStore('readonly', s => s.getAllKeys()); }
  };
})();
