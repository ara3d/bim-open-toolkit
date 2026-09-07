import { readFile, writeFile } from 'node:fs/promises';
import { bosToBfast } from '../dist/index.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/bos-to-bfast.mjs <input.bos> <output.bfast>');
const bytes = await readFile(input);
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const result = await bosToBfast(buffer);
// Never overwrite an existing model accidentally.
await writeFile(output, new Uint8Array(result), { flag: 'wx' });
console.log(`Wrote ${result.byteLength} bytes of prepared geometry and original Parquet tables.`);
