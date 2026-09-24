import type { Dataset, DatasetRecord } from '../types';

const DB_NAME = 'syntheticlab_db';
const DB_VERSION = 1;
const STORE_DATASETS = 'datasets';
const STORE_RECORDS = 'records';

class StorageDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_DATASETS)) {
          db.createObjectStore(STORE_DATASETS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const recordStore = db.createObjectStore(STORE_RECORDS, { keyPath: ['datasetId', 'rowId'] });
          recordStore.createIndex('by_dataset', 'datasetId', { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  async saveDataset(dataset: Dataset): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DATASETS, STORE_RECORDS], 'readwrite');
      const dsStore = tx.objectStore(STORE_DATASETS);
      const recStore = tx.objectStore(STORE_RECORDS);

      // Save metadata without records to keep index light
      const metadata = {
        ...dataset,
        records: [] // records stored in dedicated table
      };
      dsStore.put(metadata);

      // Clear existing records for this dataset if any
      const index = recStore.index('by_dataset');
      const getKeys = index.getAllKeys(IDBKeyRange.only(dataset.id));
      getKeys.onsuccess = () => {
        const keys = getKeys.result;
        keys.forEach(k => recStore.delete(k));

        // Insert new records in batch
        dataset.records.forEach(r => {
          recStore.put({
            datasetId: dataset.id,
            rowId: r._rowId,
            data: r
          });
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDataset(id: string): Promise<Dataset | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DATASETS, STORE_RECORDS], 'readonly');
      const dsStore = tx.objectStore(STORE_DATASETS);
      const recStore = tx.objectStore(STORE_RECORDS);

      const dsReq = dsStore.get(id);

      dsReq.onsuccess = () => {
        const meta = dsReq.result;
        if (!meta) {
          resolve(null);
          return;
        }

        const index = recStore.index('by_dataset');
        const recReq = index.getAll(IDBKeyRange.only(id));

        recReq.onsuccess = () => {
          const records: DatasetRecord[] = (recReq.result || [])
            .map((item: any) => item.data)
            .sort((a: DatasetRecord, b: DatasetRecord) => a._rowId - b._rowId);

          resolve({
            ...meta,
            records
          });
        };
        recReq.onerror = () => reject(recReq.error);
      };

      dsReq.onerror = () => reject(dsReq.error);
    });
  }

  async getAllDatasetsMetadata(): Promise<Omit<Dataset, 'records'>[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DATASETS], 'readonly');
      const dsStore = tx.objectStore(STORE_DATASETS);
      const req = dsStore.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteDataset(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DATASETS, STORE_RECORDS], 'readwrite');
      const dsStore = tx.objectStore(STORE_DATASETS);
      const recStore = tx.objectStore(STORE_RECORDS);

      dsStore.delete(id);

      const index = recStore.index('by_dataset');
      const keysReq = index.getAllKeys(IDBKeyRange.only(id));
      keysReq.onsuccess = () => {
        keysReq.result.forEach(k => recStore.delete(k));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DATASETS, STORE_RECORDS], 'readwrite');
      tx.objectStore(STORE_DATASETS).clear();
      tx.objectStore(STORE_RECORDS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const idb = new StorageDatabase();
