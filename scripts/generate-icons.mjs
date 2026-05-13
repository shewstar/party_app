import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// Minimal solid-color PNG generator. Renders a single-letter "B" on a
// warm-cream background so the PWA has an installable icon.

function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Letter "B" drawn as a low-res bitmap mask (7 wide x 9 tall).
const LETTER = [
  "1111100",
  "1000110",
  "1000110",
  "1000110",
  "1111100",
  "1000110",
  "1000110",
  "1000110",
  "1111100",
];

function inside(x, y, size) {
  // Map pixel to letter cell.
  const margin = Math.floor(size * 0.18);
  const drawSize = size - margin * 2;
  if (x < margin || y < margin || x >= size - margin || y >= size - margin) return false;
  const col = Math.floor(((x - margin) / drawSize) * LETTER[0].length);
  const row = Math.floor(((y - margin) / drawSize) * LETTER.length);
  return LETTER[row]?.[col] === "1";
}

function makePng(size) {
  const bg = [0xf7, 0xf6, 0xf2]; // app cream
  const fg = [0x4a, 0x3a, 0x2a]; // dark brown
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const on = inside(x, y, size);
      const c = on ? fg : bg;
      raw[p++] = c[0];
      raw[p++] = c[1];
      raw[p++] = c[2];
      raw[p++] = 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/icon-192.png", makePng(192));
writeFileSync("public/icon-512.png", makePng(512));
console.log("Wrote public/icon-192.png and public/icon-512.png");
