// [LPS] in the human's task list: the standard link-preview tags (Open Graph,
// plus Twitter's card type) in the HTML the server sends, since the crawlers
// that build previews (iMessage, Slack, WhatsApp, Facebook, Discord, ...)
// don't run the page's JavaScript. No words are pinned: only that the tags
// exist, agree with each other and with <title>, use the app's address on Fly
// (from fly.toml), and point at an image the app serves that's big enough for
// a large preview card (about 1.91:1, at least 600x315; Facebook won't take
// less than 200x200) and small enough for WhatsApp (under 300 KB).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildApp, rer, startServer } from './app.mjs';

const app = fs.readFileSync(path.join(ROOT, 'fly.toml'), 'utf8').match(/^app\s*=\s*['"]([^'"]+)['"]/m)?.[1];
assert.ok(app, rer('read fly.toml', 'an app name (app = \'...\')', 'none found'));
const origin = `https://${app}.fly.dev`;

await buildApp();
const server = await startServer([]);
try {
  const html = await (await fetch(`${server.url}/`)).text();
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  // Each <meta>'s content, by its property or name.
  const meta = Object.fromEntries([...html.matchAll(/<meta\s[^>]*>/g)].map(([tag]) => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    return [attrs.property ?? attrs.name, attrs.content];
  }));
  const read = 'GET / from server.js and read its <meta> tags';
  const has = (key, expected, ok) => assert.ok(ok, rer(read, `${key}: ${expected}`, JSON.stringify(meta[key])));

  has('og:title', `the same as <title> (${JSON.stringify(title)})`, title !== undefined && meta['og:title'] === title);
  has('og:description', 'some text', typeof meta['og:description'] === 'string' && meta['og:description'].trim() !== '');
  has('description', 'the same as og:description', meta.description === meta['og:description']);
  has('og:type', '"website"', meta['og:type'] === 'website');
  has('og:url', `"${origin}/"`, meta['og:url'] === `${origin}/`);
  has('twitter:card', '"summary_large_image"', meta['twitter:card'] === 'summary_large_image');
  has('og:image:alt', 'some text', typeof meta['og:image:alt'] === 'string' && meta['og:image:alt'].trim() !== '');
  has('og:image', `an image at ${origin}/...`, typeof meta['og:image'] === 'string' && meta['og:image'].startsWith(`${origin}/`));

  // The image, fetched by its path from this server.
  const imagePath = new URL(meta['og:image']).pathname;
  const response = await fetch(`${server.url}${imagePath}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const fetched = `GET ${imagePath} (og:image's path) from server.js`;
  assert.ok(response.status === 200 && response.headers.get('content-type') === 'image/png', rer(fetched, '200, a PNG',
    `${response.status}, ${response.headers.get('content-type')}`));
  // A PNG's width and height are the two big-endian numbers right after its IHDR chunk's name.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.ok(width >= 600 && height >= 315 && Math.abs(width / height - 1.91) < 0.05 && bytes.length < 300_000, rer(fetched,
    'at least 600x315, about 1.91:1, under 300 KB', `${width}x${height}, ${bytes.length} bytes`));
  assert.deepEqual([meta['og:image:width'], meta['og:image:height']], [String(width), String(height)], rer(read,
    `og:image:width and og:image:height matching the image (${width}x${height})`,
    JSON.stringify([meta['og:image:width'], meta['og:image:height']])));
} finally {
  await server.stop();
}

console.log('qual pass: link-preview tags (Open Graph, Twitter card) and their image');
