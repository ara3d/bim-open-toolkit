// Read-only fixture benchmark. Never writes or distributes the private BOS archive.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { bosToGroups, parseBosGeometry } from '@ara3d/viewer-loaders';
import { groupBounds, unionBounds } from '@ara3d/viewer-core';

const source = process.argv[2] ?? 'C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos';
const start = performance.now();
const bytes = await readFile(source);
const readMs = performance.now() - start;
const sha256 = createHash('sha256').update(bytes).digest('hex');
const parseStart = performance.now();
const bos = await parseBosGeometry(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const parseMs = performance.now() - parseStart;
const convertStart = performance.now();
const converted = bosToGroups({ ...bos, EntityLocalId: null });
const convertMs = performance.now() - convertStart;
const boundsStart = performance.now();
const bounds = converted.groups.reduce((result, group) => unionBounds(result, groupBounds(group)), null);
const boundsMs = performance.now() - boundsStart;
const entities = new Set(bos.InstanceEntityIndex);
for (let i = 0; i < (bos.EntityLocalId?.length ?? 0); i++) entities.add(i);
console.log(JSON.stringify({
  fixture: source, sha256, bytes: bytes.byteLength,
  environment: { os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, node: process.version },
  protocol: 'One read/parse/convert sample; no warmup. CPU-only, no display/GPU timing. Bounds in source coordinates.',
  counts: { objects: entities.size, entityRows: bos.EntityLocalId?.length ?? 0, sourceInstances: bos.InstanceEntityIndex.length, renderedInstances: converted.instanceCount, groups: converted.groups.length,
    triangles: converted.groups.reduce((n, g) => n + (g.mesh.indices?.length ?? g.mesh.positions.length / 3) / 3 * g.instanceCount, 0) },
  bounds, timingMs: { read: readMs, parse: parseMs, convert: convertMs, bounds: boundsMs },
}, null, 2));
