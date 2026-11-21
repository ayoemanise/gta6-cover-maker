// Photo loading: files from the person's machine become image objects and thumbnails. Nothing is
// uploaded — the files are read right here in the browser with object URLs.

/** Loads one image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Loads every file in the input's FileList as a drawable image, keeping its name. */
export async function loadPhotoFiles(files) {
  const photos = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      photos.push({ img, name: file.name });
    } catch {
      // a file the browser cannot decode is skipped, not fatal
    }
  }
  return photos;
}

/** A square cover-cropped thumbnail for the photo strip. */
export function makeThumb(img, size) {
  const thumb = document.createElement('canvas');
  thumb.width = thumb.height = size;
  const tc = thumb.getContext('2d');
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  tc.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return thumb;
}
