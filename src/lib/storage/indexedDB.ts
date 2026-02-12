/**
 * IndexedDB wrapper for auto-save functionality
 * Provides persistent storage for Napkin documents
 */

import type { ExcaliDocument } from './schema';

const DB_NAME = 'napkin';
const STORE_NAME = 'documents';
const AUTOSAVE_KEY = 'autosave';
const DB_VERSION = 1;

/**
 * IndexedDB database instance
 * Cached after first initialization
 */
let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 * Creates the object store if it doesn't exist
 *
 * @returns Promise that resolves to the database instance
 */
export async function init(): Promise<IDBDatabase> {
  // Return cached instance if already initialized
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save document to IndexedDB auto-save slot
 *
 * @param document - The document to save
 * @returns Promise that resolves when save is complete
 */
export async function saveAutosave(document: ExcaliDocument): Promise<void> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(document, AUTOSAVE_KEY);

    request.onerror = () => {
      reject(new Error(`Failed to save autosave: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Load document from IndexedDB auto-save slot
 *
 * @returns Promise that resolves to the saved document, or null if none exists
 */
export async function loadAutosave(): Promise<ExcaliDocument | null> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(AUTOSAVE_KEY);

    request.onerror = () => {
      reject(new Error(`Failed to load autosave: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const result = request.result;
      resolve(result !== undefined ? result : null);
    };
  });
}

/**
 * Clear the auto-save slot
 *
 * @returns Promise that resolves when clear is complete
 */
export async function clearAutosave(): Promise<void> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(AUTOSAVE_KEY);

    request.onerror = () => {
      reject(new Error(`Failed to clear autosave: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Save a named document to IndexedDB
 *
 * @param key - The key to save the document under
 * @param document - The document to save
 * @returns Promise that resolves when save is complete
 */
export async function saveDocument(key: string, document: ExcaliDocument): Promise<void> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(document, key);

    request.onerror = () => {
      reject(new Error(`Failed to save document: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Load a named document from IndexedDB
 *
 * @param key - The key of the document to load
 * @returns Promise that resolves to the document, or null if not found
 */
export async function loadDocument(key: string): Promise<ExcaliDocument | null> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => {
      reject(new Error(`Failed to load document: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const result = request.result;
      resolve(result !== undefined ? result : null);
    };
  });
}

/**
 * List all document keys in IndexedDB
 *
 * @returns Promise that resolves to an array of keys
 */
export async function listDocuments(): Promise<string[]> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => {
      reject(new Error(`Failed to list documents: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const keys = request.result as string[];
      resolve(keys);
    };
  });
}

/**
 * Delete a named document from IndexedDB
 *
 * @param key - The key of the document to delete
 * @returns Promise that resolves when delete is complete
 */
export async function deleteDocument(key: string): Promise<void> {
  const db = await init();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => {
      reject(new Error(`Failed to delete document: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}
