const DB_NAME = 'superapp-secure-store'
const STORE_NAME = 'qr-keys'
const DB_VERSION = 2

interface QrPrivateKeyRecord {
  webDeviceId: string
  privateKey: string
  publicKey?: string
  createdAt: number
  updatedAt?: number
}

export class IndexedDbKeyStore {
  static buildScopedStorageKey(ownerUserId: number | string, webDeviceId: string): string {
    return `user:${String(ownerUserId)}:device:${webDeviceId}`
  }

  async saveDeviceKeyMaterial(webDeviceId: string, privateKey: string, publicKey?: string): Promise<void> {
    const db = await this.open()

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({
        webDeviceId,
        privateKey,
        publicKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as QrPrivateKeyRecord)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
  }

  async savePrivateKey(webDeviceId: string, privateKey: string): Promise<void> {
    await this.saveDeviceKeyMaterial(webDeviceId, privateKey)
  }

  async getPrivateKey(webDeviceId: string): Promise<string | null> {
    const result = await this.getDeviceKeyMaterial(webDeviceId)
    return result?.privateKey ?? null
  }

  async getDeviceKeyMaterial(
    webDeviceId: string,
  ): Promise<{ privateKey: string; publicKey: string | null } | null> {
    const db = await this.open()

    const result = await new Promise<QrPrivateKeyRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(webDeviceId)
      request.onsuccess = () => resolve(request.result as QrPrivateKeyRecord | undefined)
      request.onerror = () => reject(request.error)
    })

    db.close()
    if (!result?.privateKey) {
      return null
    }

    return {
      privateKey: result.privateKey,
      publicKey: result.publicKey ?? null,
    }
  }

  async removePrivateKey(webDeviceId: string): Promise<void> {
    const db = await this.open()

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(webDeviceId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
  }

  async clearAll(): Promise<void> {
    const db = await this.open()

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
  }

  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'webDeviceId' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}
