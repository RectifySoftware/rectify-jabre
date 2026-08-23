// Generates placeholder /assets/logo.png and /assets/icon.ico
// Pure Node (fs + zlib), no external dependencies.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- pixel drawing: glossy red/black sphere placeholder ----
function drawSphere(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.48;
  const innerR = size * 0.42;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (dist > outerR) {
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 0;
        continue;
      }
      if (dist > innerR) {
        buf[idx] = 10; buf[idx + 1] = 10; buf[idx + 2] = 10; buf[idx + 3] = 255;
        continue;
      }
      // glossy red gradient, highlight upper-left
      const hlx = cx - innerR * 0.4, hly = cy - innerR * 0.5;
      const hdist = Math.sqrt((x - hlx) ** 2 + (y - hly) ** 2) / innerR;
      const light = Math.max(0, 1 - hdist * 1.3);
      const r = Math.min(255, 120 + light * 130 + 55);
      const g = Math.min(255, 10 + light * 90);
      const b = Math.min(255, 12 + light * 90);
      buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
    }
  }
  return buf;
}

// ---- minimal PNG encoder ----
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- minimal ICO encoder (BMP/DIB frames, 32bpp with alpha) ----
function encodeICO(sizes) {
  const images = sizes.map((size) => {
    const rgba = drawSphere(size);
    // BMP DIB header expects BGRA, bottom-up rows, plus AND mask
    const dibHeaderSize = 40;
    const pixelDataSize = size * size * 4;
    const andMaskRowBytes = Math.ceil(size / 8 / 4) * 4;
    const andMaskSize = andMaskRowBytes * size;
    const dib = Buffer.alloc(dibHeaderSize + pixelDataSize + andMaskSize);
    dib.writeUInt32LE(dibHeaderSize, 0);
    dib.writeInt32LE(size, 4);
    dib.writeInt32LE(size * 2, 8); // height*2 for ico (includes mask)
    dib.writeUInt16LE(1, 12); // planes
    dib.writeUInt16LE(32, 14); // bpp
    dib.writeUInt32LE(0, 16); // compression
    dib.writeUInt32LE(pixelDataSize, 20);

    let off = dibHeaderSize;
    for (let y = size - 1; y >= 0; y--) {
      for (let x = 0; x < size; x++) {
        const srcIdx = (y * size + x) * 4;
        dib[off++] = rgba[srcIdx + 2]; // B
        dib[off++] = rgba[srcIdx + 1]; // G
        dib[off++] = rgba[srcIdx + 0]; // R
        dib[off++] = rgba[srcIdx + 3]; // A
      }
    }
    // AND mask: all zero (fully opaque via alpha channel)
    return { size, data: dib };
  });

  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * images.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  const dataParts = [];
  images.forEach((img) => {
    const entry = Buffer.alloc(dirEntrySize);
    entry[0] = img.size >= 256 ? 0 : img.size;
    entry[1] = img.size >= 256 ? 0 : img.size;
    entry[2] = 0; entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += img.data.length;
    dirEntries.push(entry);
    dataParts.push(img.data);
  });

  return Buffer.concat([header, ...dirEntries, ...dataParts]);
}

const logoBuf = drawSphere(256);
fs.writeFileSync(path.join(OUT_DIR, 'logo.png'), encodePNG(logoBuf, 256));
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), encodeICO([16, 32, 48, 256]));

console.log('Generated assets/logo.png and assets/icon.ico');
