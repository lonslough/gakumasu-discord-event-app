import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const source = fileURLToPath(new URL('.', import.meta.url))
await build({absWorkingDir:source,entryPoints:['src/main.tsx'],bundle:true,outfile:'../app.js',format:'iife',jsx:'automatic',define:{'import.meta.env.BASE_URL':'"./"','import.meta.env.DEV':'false','process.env.NODE_ENV':'"production"'},minify:true,legalComments:'eof'})
