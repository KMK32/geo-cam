// src/utils/generateReport.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Resize/compress a local image file (recommended to avoid huge PDFs).
 * Returns URI of the resized image (file://).
 */
async function resizeLocalImageIfNeeded(uri: string, maxWidth = 1200, quality = 0.7): Promise<{ uri: string; base64?: string | null }> {
  try {
    // If not a local file or content uri, return original
    if (!uri) return { uri, base64: null };

    // If content:// (Android) or file://, use ImageManipulator to resize and optionally produce base64
    // We will request base64 here for content URIs because FileSystem can't read content:// directly on some Android devices
    const needBase64 = uri.startsWith('content://');
    const ops: any[] = [];
    // If width is provided we resize
    ops.push({ resize: { width: maxWidth } });

    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      ops,
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: needBase64 }
    );

    return { uri: manipResult.uri, base64: manipResult.base64 ?? null };
  } catch (e) {
    console.warn('resizeLocalImageIfNeeded error:', e);
    return { uri, base64: null };
  }
}

/**
 * Convert a given image URI to a data:...;base64,... string suitable for embedding in HTML.
 * - remote http(s) -> returned as-is
 * - data:... -> returned as-is
 * - file:// -> resized (if needed) and read via FileSystem -> return data URI
 * - content:// -> ImageManipulator returns base64 -> return data URI
 */
async function imageSrcForPrint(uri?: string | null): Promise<string> {
  if (!uri) return '';
  try {
    // remote URL -> return as-is
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

    // Already a data URI -> return as-is
    if (uri.startsWith('data:')) return uri;

    // Local or content uri -> resize/compress and get base64
    if (uri.startsWith('file://') || uri.startsWith('/') || uri.startsWith('content://')) {
      // Resize & possibly get base64 (ImageManipulator will return base64 for content://)
      const { uri: resizedUri, base64 } = await resizeLocalImageIfNeeded(uri, 1200, 0.7);

      // If ImageManipulator gave base64 (content:// or requested), use it
      if (base64) {
        // assume jpeg
        return `data:image/jpeg;base64,${base64}`;
      }

      // Otherwise, read resizedUri via FileSystem as base64
      try {
        const base64str = await FileSystem.readAsStringAsync(resizedUri, { encoding: 'base64' });
        // infer mime
        const ext = (resizedUri.split('.').pop() || 'jpg').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${base64str}`;
      } catch (e) {
        console.warn('readAsStringAsync failed for', resizedUri, e);
        return '';
      }
    }

    // fallback
    return uri;
  } catch (e) {
    console.warn('imageSrcForPrint error', e);
    return '';
  }
}

/**
 * Main PDF generator
 */
export async function generateReportPDF(data: {
  photoUri: string | null;
  coords: { latitude: number; longitude: number } | null;
  weather: any;
  indices: any;
  species: Array<{ name: string; image: string | null }>;
}) {
  try {
    // Convert main photo (if any)
    const photoSrc = await imageSrcForPrint(data.photoUri);

    // Convert species images in parallel (limit to 5)
    const speciesWithSrc = await Promise.all(
      (data.species ?? []).slice(0, 5).map(async (s) => {
        const src = await imageSrcForPrint(s.image ?? null);
        return { ...s, _src: src };
      })
    );

    const imgTag = (src: string, w = 400, h = 300) =>
      src ? `<img src="${src}" style="width:${w}px; height:${h}px; object-fit:cover; border-radius:6px; display:block; margin-bottom:8px;" />` : '';

    const html = `
      <html>
        <body style="font-family: Arial, Helvetica, sans-serif; padding: 18px; color: #222;">
          <h1 style="text-align:center; margin-bottom: 6px;">Advanced Geo Cam — Report</h1>

          ${photoSrc ? imgTag(photoSrc, 600, 360) : ''}

          <h2 style="margin-top:8px;">📍 Location</h2>
          <p><b>Latitude:</b> ${data.coords?.latitude ?? '—'}</p>
          <p><b>Longitude:</b> ${data.coords?.longitude ?? '—'}</p>

          <h2 style="margin-top:8px;">🌦 Weather Summary</h2>
          <p><b>Temperature:</b> ${data.weather?.temperature ?? '—'} °C</p>
          <p><b>Humidity:</b> ${data.weather?.humidity ?? '—'} %</p>
          <p><b>Pressure:</b> ${data.weather?.pressure ?? '—'} hPa</p>
          <p><b>Wind:</b> ${data.weather?.windspeed ?? '—'} m/s</p>
          <p><b>Cloud Cover:</b> ${data.weather?.cloudcover ?? '—'} %</p>

          <h2 style="margin-top:8px;">🌩 Climate Indices</h2>
          <p><b>CAPE:</b> ${data.indices?.cape ?? '—'}</p>
          <p><b>CIN:</b> ${data.indices?.cin ?? '—'}</p>
          <p><b>LI:</b> ${data.indices?.li ?? '—'}</p>
          <p><b>Showalter Index:</b> ${data.indices?.si ?? '—'}</p>
          <p><b>K Index:</b> ${data.indices?.ki ?? '—'}</p>
          <p><b>Total Totals Index:</b> ${data.indices?.tti ?? '—'}</p>

          <h2 style="margin-top:8px;">🐾 Nearby Biodiversity</h2>
          ${speciesWithSrc
            .map(
              (s) => `
                <div style="margin-bottom:10px;">
                  <p style="margin:0; font-weight:700;">${s.name}</p>
                  ${s._src ? imgTag(s._src, 140, 100) : '<p style="color:#666; margin-top:6px;">No Image Available</p>'}
                </div>
              `
            )
            .join('')}

          <p style="text-align:center; margin-top: 24px; font-size:12px; color:#666;">
            Generated on ${new Date().toLocaleString()}
          </p>
        </body>
      </html>
    `;

    // generate PDF file
    const { uri } = await Print.printToFileAsync({ html });

    // share the file
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      alert('Sharing not available on this device');
      return;
    }
    await Sharing.shareAsync(uri);
  } catch (e) {
    console.error('PDF generation error:', e);
    alert('Could not create PDF. See console for details.');
  }
}
