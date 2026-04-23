/**
 * receiptCompression.js
 * Client-side resize + JPEG compression for receipt images.
 * Uses the built-in Canvas API — no external dependencies.
 */

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB pre-compression

/**
 * Converts a Blob to a base64 data string (without the data-URI prefix).
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Strip "data:<mime>;base64," prefix
      const b64 = result.split(',')[1];
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Validates a file and compresses it to JPEG for vision API upload.
 *
 * @param {File} file - The image file selected by the user.
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<{ b64: string, blobUrl: string, mediaType: string, originalSize: number, compressedSize: number }>}
 * @throws {Error} with a machine-readable code in `.code` property:
 *   - 'unsupported_mime_type'
 *   - 'file_too_large'
 *   - 'compress_failed'
 */
export async function compressReceiptImage(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  // Validate MIME type (client-side guard).
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    const err = new Error(`Unsupported file type: ${file.type}`);
    err.code = 'unsupported_mime_type';
    throw err;
  }

  // Validate pre-compression size (client-side guard).
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const err = new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB`);
    err.code = 'file_too_large';
    throw err;
  }

  // Draw to canvas at reduced size.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC images may not decode via createImageBitmap in all browsers.
    // Fall back: read the raw file as base64 without resizing.
    const b64 = await blobToBase64(file);
    const blobUrl = URL.createObjectURL(file);
    return {
      b64,
      blobUrl,
      mediaType: 'image/jpeg', // treat as jpeg for API
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          const err = new Error('Canvas toBlob produced null');
          err.code = 'compress_failed';
          return reject(err);
        }
        try {
          const b64 = await blobToBase64(blob);
          const blobUrl = URL.createObjectURL(blob);
          resolve({
            b64,
            blobUrl,
            mediaType: 'image/jpeg',
            originalSize: file.size,
            compressedSize: blob.size,
          });
        } catch (e) {
          reject(e);
        }
      },
      'image/jpeg',
      quality,
    );
  });
}
