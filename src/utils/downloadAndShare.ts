import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saves a Blob (from one of the api client's requestBlob calls) to a local file and
 * opens the native share sheet so the user can save/print/send it. On web, falls back
 * to triggering a normal browser download.
 */
export async function downloadAndShare(blob: Blob, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}
