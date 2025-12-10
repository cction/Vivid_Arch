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

async function main() {
  console.log('base', ORIGIN, 'useProxy', USE_PROXY, 'hasKey', Boolean(KEY));

  const gen1 = await postJson('/v1/images/generations', { model: 'nano-banana', prompt: 'a cat in watercolor', response_format: 'url', aspect_ratio: '3:4' });
  const item1 = gen1 && gen1.data && gen1.data[0];
  const chk1 = item1 && item1.url ? await fetchImage(String(item1.url)) : null;
  console.log('gen:nano-banana', { url: item1 && item1.url, ok: chk1 && chk1.ok, mime: chk1 && chk1.mime, size: chk1 && chk1.size });

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
}

main().catch(e => { console.error('test failed', String(e && e.message || e)); process.exit(1); });