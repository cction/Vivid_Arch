const BASE = process.env.WHATAI_BASE_URL || 'https://api.whatai.cc';
const KEY = process.env.WHATAI_API_KEY || '';
const USE_PROXY = !KEY;
const ORIGIN = USE_PROXY ? 'http://localhost:3001/proxy-whatai' : BASE;

const headers = KEY ? { Authorization: `Bearer ${KEY}`, Accept: 'application/json' } : { Accept: 'application/json' };

async function postJson(path, body) {
  const r = await fetch(`${ORIGIN}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const ct = r.headers.get('content-type') || '';
  const text = await r.text();
  if (!ct.includes('application/json')) throw new Error(`HTTP ${r.status} ${ct} ${text.slice(0,200)}`);
  return JSON.parse(text);
}

async function postForm(path, form) {
  const r = await fetch(`${ORIGIN}${path}`, { method: 'POST', headers, body: form });
  const ct = r.headers.get('content-type') || '';
  const text = await r.text();
  if (!ct.includes('application/json')) throw new Error(`HTTP ${r.status} ${ct} ${text.slice(0,200)}`);
  return JSON.parse(text);
}

function filePng() {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YbODXcAAAAASUVORK5CYII=';
  const buf = Buffer.from(b64, 'base64');
  return new File([buf], 'input.png', { type: 'image/png' });
}

async function fetchImage(url) {
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  const blob = await r.blob();
  return { ok: ct.startsWith('image/'), size: blob.size, mime: blob.type || ct };
}

async function sampleFile() {
  const r = await fetch('https://webstatic.aiproxy.vip/logo.png');
  const blob = await r.blob();
  const ab = await blob.arrayBuffer();
  return new File([ab], 'sample.png', { type: blob.type || 'image/png' });
}

const PRO_1K_SIZES = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 848, h: 1264 },
  '3:2': { w: 1264, h: 848 },
  '3:4': { w: 896, h: 1200 },
  '4:3': { w: 1200, h: 896 },
  '4:5': { w: 928, h: 1152 },
  '5:4': { w: 1152, h: 928 },
  '9:16': { w: 768, h: 1376 },
  '16:9': { w: 1376, h: 768 },
  '21:9': { w: 1584, h: 672 }
}
const FLASH_1K_SIZES = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 832, h: 1248 },
  '3:2': { w: 1248, h: 832 },
  '3:4': { w: 864, h: 1184 },
  '4:3': { w: 1184, h: 864 },
  '4:5': { w: 896, h: 1152 },
  '5:4': { w: 1152, h: 896 },
  '9:16': { w: 768, h: 1344 },
  '16:9': { w: 1344, h: 768 },
  '21:9': { w: 1536, h: 672 }
}
function expectedDims(model, size, ar) {
  const isPro = model === 'nano-banana-2' || model === 'nano-banana-pro';
  const base = isPro ? (PRO_1K_SIZES[ar] || PRO_1K_SIZES['1:1']) : (FLASH_1K_SIZES[ar] || FLASH_1K_SIZES['1:1']);
  const eff = isPro ? size : '1K';
  const mul = eff === '4K' ? 4 : eff === '2K' ? 2 : 1;
  return { width: base.w * mul, height: base.h * mul };
}
async function fetchImageDims(url) {
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);
  if (ct.startsWith('image/png')) {
    const idx = buf.indexOf(Buffer.from('IHDR'));
    if (idx >= 0) {
      const w = buf.readUInt32BE(idx + 4);
      const h = buf.readUInt32BE(idx + 8);
      return { ok: true, mime: ct, width: w, height: h };
    }
  }
  return { ok: false, mime: ct, width: null, height: null };
}

function dimsFromBase64PNG(b64) {
  const raw = String(b64);
  const data = raw.startsWith('data:') ? raw.split('base64,').pop() || '' : raw;
  const buf = Buffer.from(data, 'base64');
  const idx = buf.indexOf(Buffer.from('IHDR'));
  if (idx >= 0) {
    const w = buf.readUInt32BE(idx + 4);
    const h = buf.readUInt32BE(idx + 8);
    return { ok: true, width: w, height: h };
  }
  return { ok: false, width: null, height: null };
}

async function main() {
  console.log('base', ORIGIN, 'useProxy', USE_PROXY, 'hasKey', Boolean(KEY));

  const gen1 = await postJson('/v1/images/generations', { model: 'nano-banana', prompt: 'a cat in watercolor', response_format: 'url', aspect_ratio: '3:4' });
  const item1 = gen1 && gen1.data && gen1.data[0];
  const chk1 = item1 && item1.url ? await fetchImage(String(item1.url)) : null;
  console.log('gen:nano-banana', { url: item1 && item1.url, ok: chk1 && chk1.ok, mime: chk1 && chk1.mime, size: chk1 && chk1.size });
  if (item1 && item1.url) {
    const d1 = await fetchImageDims(String(item1.url));
    const ex1 = expectedDims('nano-banana', '1K', '3:4');
    const ok1 = d1.ok && d1.width === ex1.width && d1.height === ex1.height;
    console.log('assert:size nano-banana', { expected: ex1, actual: { width: d1.width, height: d1.height }, ok: ok1, mime: d1.mime });
  }

  const form2 = new FormData();
  form2.append('model', 'nano-banana-2');
  form2.append('prompt', 'a cat in pixel art');
  form2.append('response_format', 'url');
  form2.append('aspect_ratio', '3:4');
  form2.append('image_size', '1K');
  form2.append('image', await sampleFile());
  const gen2 = await postForm('/v1/images/edits', form2);
  const item2 = gen2 && gen2.data && gen2.data[0];
  const chk2 = item2 && item2.url ? await fetchImage(String(item2.url)) : null;
  console.log('gen:nano-banana-2', { url: item2 && item2.url, ok: chk2 && chk2.ok, mime: chk2 && chk2.mime, size: chk2 && chk2.size });
  if (!item2 || !item2.url) console.log('gen:nano-banana-2 raw', gen2);

  const form3 = new FormData();
  form3.append('model', 'nano-banana-2');
  form3.append('prompt', 'add a red hat to the subject');
  form3.append('response_format', 'url');
  form3.append('aspect_ratio', '3:4');
  form3.append('image_size', '1K');
  form3.append('image', await sampleFile());
  const edit3 = await postForm('/v1/images/edits', form3);
  const item3 = edit3 && edit3.data && edit3.data[0];
  const chk3 = item3 && item3.url ? await fetchImage(String(item3.url)) : null;
  console.log('edit:nano-banana-2', { url: item3 && item3.url, ok: chk3 && chk3.ok, mime: chk3 && chk3.mime, size: chk3 && chk3.size });
  if (!item3 || !item3.url) console.log('edit:nano-banana-2 raw', edit3);

  const gen4 = await postJson('/v1/images/generations', { model: 'nano-banana-2', prompt: 'a cat with neon style', response_format: 'url', aspect_ratio: '3:4', image_size: '1K' });
  const item4 = gen4 && gen4.data && gen4.data[0];
  const chk4 = item4 && item4.url ? await fetchImage(String(item4.url)) : null;
  console.log('gen:nano-banana-2 via generations', { url: item4 && item4.url, ok: chk4 && chk4.ok, mime: chk4 && chk4.mime, size: chk4 && chk4.size });
  if (!item4 || !item4.url) console.log('gen:nano-banana-2 generations raw', gen4);
  if (item4 && item4.url) {
    const d4 = await fetchImageDims(String(item4.url));
    const ex4 = expectedDims('nano-banana-2', '1K', '3:4');
    const ok4 = d4.ok && d4.width === ex4.width && d4.height === ex4.height;
    console.log('assert:size nano-banana-2', { expected: ex4, actual: { width: d4.width, height: d4.height }, ok: ok4, mime: d4.mime });
  }

  const gen5 = await postJson('/v1/images/generations', { model: 'nano-banana-2', prompt: 'a city at sunset', aspect_ratio: '16:9', image_size: '2K' });
  const item5 = gen5 && gen5.data && gen5.data[0];
  if (item5 && item5.b64_json) {
    const d5 = dimsFromBase64PNG(String(item5.b64_json));
    const ex5 = expectedDims('nano-banana-2', '2K', '16:9');
    const ok5 = d5.ok && d5.width === ex5.width && d5.height === ex5.height;
    console.log('assert:size nano-banana-2 2K', { expected: ex5, actual: { width: d5.width, height: d5.height }, ok: ok5 });
  } else {
    console.log('gen:nano-banana-2 2K raw', gen5);
  }

  const gen5b = await postJson('/v1/images/generations', { model: 'nano-banana-2', prompt: 'a city at night', aspect_ratio: '21:9', image_size: '2K', response_format: 'url' });
  const item5b = gen5b && gen5b.data && gen5b.data[0];
  if (item5b && item5b.url) {
    const d5b = await fetchImageDims(String(item5b.url));
    const ex5b = expectedDims('nano-banana-2', '2K', '21:9');
    const ok5b = d5b.ok && d5b.width === ex5b.width && d5b.height === ex5b.height;
    console.log('assert:size nano-banana-2 2K 21:9', { expected: ex5b, actual: { width: d5b.width, height: d5b.height }, ok: ok5b });
  }

  const form6 = new FormData();
  form6.append('model', 'nano-banana-2');
  form6.append('prompt', 'a portrait stylized');
  form6.append('aspect_ratio', '3:4');
  form6.append('image_size', '4K');
  form6.append('response_format', 'b64_json');
  form6.append('image', await sampleFile());
  const edit6 = await postForm('/v1/images/edits', form6);
  const item6 = edit6 && edit6.data && edit6.data[0];
  if (item6 && item6.b64_json) {
    const d6 = dimsFromBase64PNG(String(item6.b64_json));
    const ex6 = expectedDims('nano-banana-2', '4K', '3:4');
    const ok6 = d6.ok && d6.width === ex6.width && d6.height === ex6.height;
    console.log('assert:size nano-banana-2 4K', { expected: ex6, actual: { width: d6.width, height: d6.height }, ok: ok6 });
  } else {
    console.log('edit:nano-banana-2 4K raw', edit6);
  }

  const gen7 = await postJson('/v1/images/generations', { model: 'nano-banana', prompt: 'a forest', aspect_ratio: '16:9', response_format: 'url' });
  const item7 = gen7 && gen7.data && gen7.data[0];
  if (item7 && item7.url) {
    const d7 = await fetchImageDims(String(item7.url));
    const ex7 = expectedDims('nano-banana', '1K', '16:9');
    const ok7 = d7.ok && d7.width === ex7.width && d7.height === ex7.height;
    console.log('assert:size nano-banana 1K 16:9', { expected: ex7, actual: { width: d7.width, height: d7.height }, ok: ok7 });
  }

  const gen8 = await postJson('/v1/images/generations', { model: 'nano-banana', prompt: 'a beach', aspect_ratio: '21:9', response_format: 'url' });
  const item8 = gen8 && gen8.data && gen8.data[0];
  if (item8 && item8.url) {
    const d8 = await fetchImageDims(String(item8.url));
    const ex8 = expectedDims('nano-banana', '1K', '21:9');
    const ok8 = d8.ok && d8.width === ex8.width && d8.height === ex8.height;
    console.log('assert:size nano-banana 1K 21:9', { expected: ex8, actual: { width: d8.width, height: d8.height }, ok: ok8 });
  }

  // Error injections
  try {
    await postJson('/v1/images/generationsX', { model: 'nano-banana', prompt: 'x', response_format: 'url', aspect_ratio: '1:1' });
    console.log('error-non-json unexpected success');
  } catch (e) {
    console.log('error-non-json ok', String(e && e.message || e).slice(0, 120));
  }
  try {
    const bad = await fetchImage('http://127.0.0.1:9/nonexistent.png');
    console.log('error-fetch-image unexpected', bad);
  } catch (e2) {
    console.log('error-fetch-image ok', String(e2 && e2.message || e2).slice(0, 120));
  }
}

main().catch(e => { console.error('test failed', String(e && e.message || e)); process.exit(1); });
