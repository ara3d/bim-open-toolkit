import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const sections=['# Public API reference\n\nGenerated from the compiled TypeScript declarations. Run `npm run docs:api` after building. Optional subpaths keep renderer, DOM and UI dependencies outside the root data API.'];
for(const [subpath,entry] of Object.entries(manifest.exports)){
  const declaration=await readFile(path.join(root,entry.types),'utf8');
  let body=declaration;
  if(subpath==='.'){
    const files=[...declaration.matchAll(/export \* from '\.\/(.+)\.js';/g)].map(match=>match[1]);
    body=(await Promise.all(files.map(async file=>`// ${file}\n${await readFile(path.join(root,'dist',`${file}.d.ts`),'utf8')}`))).join('\n');
  }
  sections.push(`## ${manifest.name}${subpath==='.'?'':subpath.slice(1)}\n\n\`\`\`ts\n${body.replace(/^\/\/# sourceMappingURL=.*$/gm,'').trim()}\n\`\`\``);
}
await writeFile(path.join(root,'docs','API.md'),sections.join('\n\n')+'\n');
console.log(`Generated ${Object.keys(manifest.exports).length} public entry points.`);
