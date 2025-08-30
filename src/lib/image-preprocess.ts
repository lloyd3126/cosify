// Lightweight client-side image preprocessing: EXIF orientation fix, max dimension resize, compression

export type PreprocessOptions = {
    maxDimension?: number; // e.g., 1536~2048; default 1600
    outputType?: 'image/webp' | 'image/jpeg' | 'image/png'; // default webp
    quality?: number; // 0..1, default 0.85
};

export async function preprocessImage(file: File, opts: PreprocessOptions = {}): Promise<File> {
    const { maxDimension = 1600, outputType = 'image/webp', quality = 0.85 } = opts;
    // Only process common raster images
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;

    const arrayBuffer = await file.arrayBuffer();
    const orientation = getExifOrientation(new DataView(arrayBuffer)); // 1..8

    const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type }));
    const img = await loadImage(blobUrl);
    URL.revokeObjectURL(blobUrl);

    // Compute target size
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    let targetW = srcW;
    let targetH = srcH;
    const larger = Math.max(srcW, srcH);
    if (larger > maxDimension) {
        const scale = maxDimension / larger;
        targetW = Math.round(srcW * scale);
        targetH = Math.round(srcH * scale);
    }

    const rotated = orientation >= 5 && orientation <= 8; // swap w/h
    const canvas = document.createElement('canvas');
    canvas.width = rotated ? targetH : targetW;
    canvas.height = rotated ? targetW : targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Apply orientation transform
    applyOrientationTransform(ctx, canvas, orientation);

    // Draw scaled image
    ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, targetW, targetH);

    const outBlob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || new Blob()), outputType, quality)
    );
    if (!outBlob.size) return file; // fallback

    const outName = ensureExtension(file.name, outputType);
    return new File([outBlob], outName, { type: outputType, lastModified: Date.now() });
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

function ensureExtension(name: string, mime: string) {
    const map: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
    const ext = map[mime] || 'png';
    return name.replace(/\.[^.]+$/, '') + '.' + ext;
}

// Parse minimal EXIF for orientation (JPEG only). Returns 1 if unknown.
function getExifOrientation(view: DataView): number {
    // JPEG: start with 0xFFD8; search for APP1 (0xFFE1) marker containing "Exif\0\0"
    if (view.byteLength < 4) return 1;
    if (view.getUint16(0) !== 0xffd8) return 1;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
        const marker = view.getUint16(offset);
        offset += 2;
        if (marker === 0xFFE1) {
            const length = view.getUint16(offset);
            offset += 2;
            // Exif header
            if (offset + 6 <= view.byteLength && view.getUint32(offset) === 0x45786966 && view.getUint16(offset + 4) === 0) {
                const tiffStart = offset + 6;
                const little = view.getUint16(tiffStart) === 0x4949;
                const get16 = (o: number) => little ? view.getUint16(o, true) : view.getUint16(o, false);
                const get32 = (o: number) => little ? view.getUint32(o, true) : view.getUint32(o, false);
                const firstIFD = get32(tiffStart + 4) + tiffStart;
                const entries = get16(firstIFD);
                for (let i = 0; i < entries; i++) {
                    const entry = firstIFD + 2 + i * 12;
                    const tag = get16(entry);
                    if (tag === 0x0112) { // Orientation
                        const value = get16(entry + 8);
                        return value >= 1 && value <= 8 ? value : 1;
                    }
                }
            }
            break; // stop scan even if not exif
        } else if ((marker & 0xFF00) !== 0xFF00) {
            break;
        } else {
            const length = view.getUint16(offset);
            offset += length;
        }
    }
    return 1;
}

function applyOrientationTransform(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, orientation: number) {
    const w = canvas.width;
    const h = canvas.height;
    switch (orientation) {
        case 2: // mirrored horizontally
            ctx.translate(w, 0); ctx.scale(-1, 1); break;
        case 3: // rotated 180
            ctx.translate(w, h); ctx.rotate(Math.PI); break;
        case 4: // mirrored vertically
            ctx.translate(0, h); ctx.scale(1, -1); break;
        case 5: // mirrored horiz then rot 90 CW
            ctx.rotate(0.5 * Math.PI); ctx.translate(0, -h); ctx.scale(1, -1); break;
        case 6: // rotated 90 CW
            ctx.rotate(0.5 * Math.PI); ctx.translate(0, -h); break;
        case 7: // mirrored horiz then rot 90 CCW
            ctx.rotate(0.5 * Math.PI); ctx.translate(w, -h); ctx.scale(-1, 1); break;
        case 8: // rotated 90 CCW
            ctx.rotate(-0.5 * Math.PI); ctx.translate(-w, 0); break;
        default:
            // 1: no transform
            break;
    }
}
