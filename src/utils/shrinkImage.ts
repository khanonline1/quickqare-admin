// Re-encodes a photo as a JPEG that is small enough to upload and light enough
// for the customer home screen.
//
// Why the byte cap: the nginx in front of api.quickqare.in refuses request
// bodies over ~1 MB (413), so a straight-from-camera photo never reaches the
// backend. Staying under ~900 KB leaves room for the multipart wrapper.
// Why the size cap: home-tile photos are downloaded on every app/web home load.
//
// Files already under the byte cap are returned untouched.

const MAX_BYTES = 900 * 1024;
const MAX_SIDE = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read this image. Use a JPG, PNG or WebP photo.")); };
    img.src = url;
  });
}

function toJpeg(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Couldn't process this image."));
  // JPEG has no transparency — paint white so transparent PNG areas don't turn black.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process this image."))), "image/jpeg", quality)
  );
}

export async function shrinkImage(file: File, maxBytes = MAX_BYTES, maxSide = MAX_SIDE): Promise<File> {
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  let scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));

  for (let attempt = 0; attempt < 6; attempt++) {
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    for (const quality of [0.85, 0.75, 0.65]) {
      const blob = await toJpeg(img, width, height, quality);
      if (blob.size <= maxBytes) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    scale *= 0.75;
  }
  throw new Error("This photo is too large even after shrinking. Try a smaller photo.");
}
