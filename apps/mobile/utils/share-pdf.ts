import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

export async function sharePdfArrayBuffer(buffer: ArrayBuffer, filename: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No writable cache directory available.');
  }

  const path = `${directory}${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const base64 = arrayBufferToBase64(buffer);
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(path, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share PDF',
    UTI: 'com.adobe.pdf',
  });
}
