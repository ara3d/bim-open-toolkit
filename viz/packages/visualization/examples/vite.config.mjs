import { defineConfig } from 'vite';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Development only: exact local fixture endpoint, no copied/distributable model asset.
export default defineConfig({
  plugins: [{
    name: 'local-snowdon-fixture',
    configureServer(server) {
      const modelPath=(bfast=false)=> bfast ? (process.env.SNOWDON_BFAST_PATH ?? path.resolve(server.config.root, '../../../../../ara3d-webgl/docs/snowdon.bfast')) : process.env.SNOWDON_BOS_PATH ?? path.join(process.env.USERPROFILE ?? '', 'Documents', 'BIM Open Schema', 'Snowdon Towers Sample Architectural.bos');
      for (const bfast of [false, true]) {
        const stem = bfast ? 'snowdon-bfast' : 'snowdon';
        server.middlewares.use(`/__fixtures/${stem}-info.json`,async (_request,response)=>{
          try {const bytes=await readFile(modelPath(bfast));response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify({sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length}));}
          catch{response.statusCode=404;response.end('Snowdon metadata unavailable');}
        });
        server.middlewares.use(`/__fixtures/${bfast ? 'snowdon.bfast' : 'snowdon.bos'}`, async (request, response) => {
          if (request.method !== 'GET' && request.method !== 'HEAD') { response.statusCode = 405; response.end(); return; }
          const filename = modelPath(bfast);
          try {
            const info = await stat(filename);
            response.setHeader('Content-Type', 'application/octet-stream');
            response.setHeader('Content-Length', info.size);
            response.setHeader('Cache-Control', 'private, max-age=3600');
            if (request.method === 'HEAD') { response.end(); return; }
            const stream = createReadStream(filename);
            response.on('close', () => stream.destroy());
            stream.on('error', () => response.destroy());
            stream.pipe(response);
          } catch { response.statusCode = 404; response.end('Snowdon is unavailable. Set SNOWDON_BOS_PATH / SNOWDON_BFAST_PATH or choose the small fixture.'); }
        });
      }
      server.middlewares.use('/__fixtures/snowdon-workflows.json',async (_request,response)=>{
        try{const filename=path.resolve(server.config.root,'../../../../artifacts/building-model-workflows/snowdon/projection.json');const info=await stat(filename);response.setHeader('Content-Type','application/json');response.setHeader('Content-Length',info.size);const stream=createReadStream(filename);response.on('close',()=>stream.destroy());stream.on('error',()=>response.destroy());stream.pipe(response);}
        catch{response.statusCode=404;response.end('Prepared Snowdon workflow projection is unavailable.');}
      });
    },
  }],
});
