import { generateStableWebDeviceId, generateX25519DeviceKeyMaterial } from './e2eeDeviceCrypto'

export interface WebDeviceKeyMaterial {
  webDeviceId: string
  webPublicKey: string
  webPrivateKey: string
}

export const generateWebDeviceId = (): string => {
  return generateStableWebDeviceId()
}

export const generateWebDeviceKeys = async (): Promise<WebDeviceKeyMaterial> => {
  try {
    const generated = await generateX25519DeviceKeyMaterial(generateWebDeviceId())
    return {
      webDeviceId: generated.deviceId,
      webPublicKey: generated.publicKey,
      webPrivateKey: generated.privateKey,
    }
  } catch (error) {
    throw new Error(
      `Browser does not support X25519 key generation for linked-device QR login${error instanceof Error && error.message ? `: ${error.message}` : '.'}`,
    )
  }
}
