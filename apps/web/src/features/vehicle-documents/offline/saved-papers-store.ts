import type { VehicleDocumentKind } from '@vehicle-vault/shared';

/** One file of a saved paper. `blob` is null when it was too large to keep. */
export type SavedPaperFile = {
  id: string;
  name: string;
  /** The type of what is kept: a downscaled photo is a JPEG whatever it was. */
  mimeType: string;
  blob: Blob | null;
};

export type SavedPaper = {
  id: string;
  kind: VehicleDocumentKind;
  number: string | null;
  provider: string | null;
  startDate: string | null;
  endDate: string | null;
  files: SavedPaperFile[];
};

/**
 * A vehicle's papers as this device keeps them, so Show papers opens with no
 * signal. Written by the signed-in user who loaded them, and read back only
 * for that user.
 */
export type SavedPapers = {
  vehicleId: string;
  userId: string;
  /** When the copy was last taken from the API, as an ISO instant. */
  savedAt: string;
  /** What the copy was built from; an unchanged one is not rebuilt. */
  signature: string;
  vehicle: {
    registrationNumber: string | null;
    electric: boolean;
    /** "Maruti Suzuki Swift VXi · Petrol" */
    description: string;
  };
  papers: SavedPaper[];
};

const DB_NAME = 'vehicle-vault-papers';
const DB_VERSION = 1;
const STORE = 'papers';

let connection: Promise<IDBDatabase | null> | null = null;
/**
 * Bumped by every clear. A save that began before a sign-out must not land
 * after it: it is written only while the epoch it started in still holds.
 */
let epoch = 0;

function promised<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * The database, or null where there is none to be had: no IndexedDB (tests,
 * some private windows) or a browser that refuses it. Every caller treats null
 * as "nothing saved", so a device that cannot keep papers still shows them
 * online.
 */
function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  connection ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: 'vehicleId' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading or deleting the database: let it, and reopen next time.
        db.onversionchange = () => {
          db.close();
          connection = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return connection;
}

export function savedPapersEpoch() {
  return epoch;
}

/** This user's saved copy of the vehicle's papers, or null. Never throws. */
export async function readSavedPapers(
  userId: string,
  vehicleId: string,
): Promise<SavedPapers | null> {
  try {
    const db = await open();
    if (!db) return null;
    const record = (await promised(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(vehicleId),
    )) as SavedPapers | undefined;
    return record && record.userId === userId ? record : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the copy, unless the device was signed out since `startedIn` (an
 * epoch from `savedPapersEpoch`). Resolves to whether it was written; a full
 * disk or a refused write is not an error worth showing.
 */
export async function writeSavedPapers(record: SavedPapers, startedIn: number): Promise<boolean> {
  try {
    const db = await open();
    if (!db || startedIn !== epoch) return false;
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(record);
    await finished(transaction);
    return startedIn === epoch;
  } catch {
    return false;
  }
}

export async function deleteSavedPapers(vehicleId: string): Promise<void> {
  try {
    const db = await open();
    if (!db) return;
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(vehicleId);
    await finished(transaction);
  } catch {
    // Nothing kept, or nothing to be done about it.
  }
}

/** Drops the copies of every vehicle not in `vehicleIds`: the user no longer has them. */
export async function keepSavedPapersFor(vehicleIds: readonly string[]): Promise<void> {
  try {
    const db = await open();
    if (!db) return;
    const keep = new Set(vehicleIds);
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const keys = await promised(store.getAllKeys());
    for (const key of keys) {
      if (typeof key === 'string' && !keep.has(key)) store.delete(key);
    }
    await finished(transaction);
  } catch {
    // As above.
  }
}

/** Forgets every saved copy on this device: on sign-out, whoever signs in next. */
export async function clearSavedPapers(): Promise<void> {
  epoch += 1;
  try {
    const db = await open();
    if (!db) return;
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    await finished(transaction);
  } catch {
    // As above.
  }
}
