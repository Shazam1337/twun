// One-time asset import from the verified local catalog; never runs on the server.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const disk = JSON.parse(await fs.readFile('.cache/pair-twelve-data-v1.json', 'utf8'));
  const symbols = [...(await fs.readFile('lib/catalog.ts', 'utf8')).matchAll(/\["([A-Z.]+)","/g)].map(m => m[1]);
  const directory = 'public/stock-logos';
  await fs.mkdir(directory, {recursive: true});
  const sources = {};
  for (let offset = 0; offset < symbols.length; offset += 5) {
    await Promise.all(symbols.slice(offset, offset + 5).map(async symbol => {
      const url = new URL(disk.universe.catalog[symbol].logo);
      if (!['api.twelvedata.com', 'logo.twelvedata.com'].includes(url.hostname) || url.protocol !== 'https:' || url.search) throw Error('Unexpected source');
      const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
      if (!response.ok) throw Error(`${symbol}: HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      await sharp(data).resize(96, 96, {fit: 'contain', background: '#ffffff'}).png().toFile(path.join(directory, `${symbol}.png`));
      sources[symbol] = url.href;
      console.log(symbol + ': saved');
    }));
  }
  console.log(`Imported ${Object.keys(sources).length} logos`);
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
