import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseBosGeometry } from '@ara3d/viewer-loaders';

// Required local-server regression: HTTP 200 alone is not successful model loading.
const filename = process.env.SNOWDON_BOS_PATH ?? `${process.env.USERPROFILE}/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`;
const url = new URL('/__fixtures/snowdon.bos', process.env.DEMO_URL ?? 'http://127.0.0.1:5173');
const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`Fixture endpoint returned ${response.status} ${response.headers.get('content-type')}; verify the configured Vite server.`);
const bytes = await response.arrayBuffer();
const magic = new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
if (magic.join(',') !== '80,75,3,4') throw new Error('Fixture response is not a ZIP archive.');
const source = await readFile(filename);
const hash = data => createHash('sha256').update(new Uint8Array(data)).digest('hex');
if (hash(bytes) !== hash(source)) throw new Error('Served Snowdon differs from the original file.');
const metadataResponse = await fetch(new URL('/__fixtures/snowdon-info.json',url), { signal: AbortSignal.timeout(15000) });
if (!metadataResponse.ok || !metadataResponse.headers.get('content-type')?.includes('application/json')) throw new Error('Snowdon metadata endpoint is unavailable or not JSON.');
const metadata = await metadataResponse.json();
if (metadata.sha256 !== hash(bytes) || metadata.bytes !== bytes.byteLength) throw new Error('Snowdon metadata does not identify the served model.');
const bos = await parseBosGeometry(bytes);
if (bos.InstanceEntityIndex.length === 0 || bos.MeshVertexOffset.length === 0) throw new Error('Snowdon contains no decoded instances/meshes.');
console.log(JSON.stringify({result:'passed',url:String(url),bytes:bytes.byteLength,sha256:hash(bytes),sourceInstances:bos.InstanceEntityIndex.length,meshes:bos.MeshVertexOffset.length},null,2));
