/**
 * Lightweight Promise-based IndexedDB Utility Wrapper
 * Zero external dependencies. Manages ewebui_db lifecycle and async operations.
 * Contract: specs/016-chat-history-persistence/contracts/storage-contract.md
 */

const DB_NAME = 'ewebui_db';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Checks whether IndexedDB is available and functional in the current browser runtime.
 * @returns {boolean}
 */
export function isIndexedDBSupported() {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Opens or retrieves the shared IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error('IndexedDB not supported or restricted in this environment'));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Sessions store (metadata only)
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 3. Preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB database'));
      };

      request.onblocked = () => {
        console.warn('IndexedDB database upgrade blocked by other open tabs');
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Executes an operation within a readwrite or readonly transaction.
 * @template T
 * @param {string | string[]} storeNames
 * @param {'readonly' | 'readwrite'} mode
 * @param {(stores: Record<string, IDBObjectStore>) => Promise<T> | IDBRequest<T>} callback
 * @returns {Promise<T>}
 */
function withTransaction(storeNames, mode, callback) {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const tx = db.transaction(names, mode);
      const stores = {};
      for (const name of names) {
        stores[name] = tx.objectStore(name);
      }

      let result;
      let callbackResult;

      try {
        callbackResult = callback(Array.isArray(storeNames) ? stores : stores[names[0]]);
      } catch (err) {
        reject(err);
        return;
      }

      if (callbackResult && typeof callbackResult.onsuccess !== 'undefined') {
        callbackResult.onsuccess = () => {
          result = callbackResult.result;
        };
      }

      tx.oncomplete = () => {
        resolve(result !== undefined ? result : callbackResult);
      };

      tx.onerror = () => {
        reject(tx.error || new Error('IndexedDB transaction failed'));
      };

      tx.onabort = () => {
        reject(tx.error || new Error('IndexedDB transaction aborted'));
      };
    });
  });
}

/**
 * Retrieves a single record by key.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<any>}
 */
export function dbGet(storeName, key) {
  return withTransaction(storeName, 'readonly', (store) => store.get(key));
}

/**
 * Stores or updates a record.
 * @param {string} storeName
 * @param {any} value
 * @returns {Promise<IDBValidKey>}
 */
export function dbSet(storeName, value) {
  return withTransaction(storeName, 'readwrite', (store) => store.put(value));
}

/**
 * Deletes a record by key.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
export function dbDel(storeName, key) {
  return withTransaction(storeName, 'readwrite', (store) => store.delete(key));
}

/**
 * Retrieves all records from a store.
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export function dbGetAll(storeName) {
  return withTransaction(storeName, 'readonly', (store) => store.getAll());
}

/**
 * Retrieves all records matching an index query.
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBValidKey | IDBKeyRange} query
 * @returns {Promise<any[]>}
 */
export function dbGetAllFromIndex(storeName, indexName, query) {
  return withTransaction(storeName, 'readonly', (store) => {
    const index = store.index(indexName);
    return index.getAll(query);
  });
}

/**
 * Deletes all records matching an index query.
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBValidKey | IDBKeyRange} query
 * @returns {Promise<void>}
 */
export function dbDeleteFromIndex(storeName, indexName, query) {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.openKeyCursor(query);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

/**
 * Clears all records in a store.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export function dbClear(storeName) {
  return withTransaction(storeName, 'readwrite', (store) => store.clear());
}
