// Décodeur PNG minimal (Node, sans dépendance) : 8 bits, non entrelacé,
// types RGB / RGBA / palette (+ tRNS) / gris. Suffisant pour les images DofusDB.
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Pas un PNG');
  let pos = 8, width, height, depth, type, interlace, palette, trns;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; type = data[9]; interlace = data[12];
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`PNG non géré (profondeur ${depth}, entrelacé ${interlace})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (type === 6) { rgba.set(px.subarray(i * 4, i * 4 + 4), o); }
    else if (type === 2) { rgba[o] = px[i * 3]; rgba[o + 1] = px[i * 3 + 1]; rgba[o + 2] = px[i * 3 + 2]; rgba[o + 3] = 255; }
    else if (type === 3) { const k = px[i]; rgba[o] = palette[k * 3]; rgba[o + 1] = palette[k * 3 + 1]; rgba[o + 2] = palette[k * 3 + 2]; rgba[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (type === 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = px[i]; rgba[o + 3] = 255; }
    else if (type === 4) { rgba[o] = rgba[o + 1] = rgba[o + 2] = px[i * 2]; rgba[o + 3] = px[i * 2 + 1]; }
  }
  return { width, height, rgba };
}
