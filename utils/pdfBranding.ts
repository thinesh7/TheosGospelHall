import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

let cachedLogoDataUri: string | null | undefined;

// expo-print renders plain HTML with no access to the app's bundled/Metro
// asset URIs, so the logo has to be downloaded to a local file-system path
// first and re-embedded as a base64 data URI. Cached per app session since
// the asset never changes at runtime.
export async function getPdfLogoDataUri(): Promise<string | null> {
  if (cachedLogoDataUri !== undefined) return cachedLogoDataUri;
  try {
    const asset = Asset.fromModule(require('../assets/images/logo.png'));
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('Logo asset has no local URI.');
    const base64 = await new File(asset.localUri).base64();
    cachedLogoDataUri = `data:image/png;base64,${base64}`;
  } catch {
    cachedLogoDataUri = null;
  }
  return cachedLogoDataUri;
}

export const PDF_LETTERHEAD_CSS = `
      .letterhead { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
      .letterhead .logo { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
      .letterhead .titleBlock { flex: 1; }
      .letterhead .title { margin-bottom: 0; }
`;

export function pdfLetterheadHtml(logoDataUri: string | null, titleBlockHtml: string): string {
  const logoHtml = logoDataUri ? `<img class="logo" src="${logoDataUri}" />` : '';
  return `<div class="letterhead">${logoHtml}<div class="titleBlock">${titleBlockHtml}</div></div>`;
}
