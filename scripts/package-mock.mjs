import { cp, mkdir } from 'node:fs/promises'

// Publish only runtime assets, never the source, dependencies or documentation.
const mock = new URL('../mock/', import.meta.url)
const destination = new URL('../dist/mock/', import.meta.url)
const runtimeAssets = ['index.html', 'app.js', 'app.css', 'images', 'sample']

await mkdir(destination, { recursive: true })
for (const asset of runtimeAssets) {
  await cp(new URL(asset, mock), new URL(asset, destination), { recursive: true })
}
