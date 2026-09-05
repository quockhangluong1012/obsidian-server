import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(new URL('../../client/public/favicon.svg', import.meta.url))
const outPath = fileURLToPath(new URL('../build/icon.png', import.meta.url))
mkdirSync(new URL('../build/', import.meta.url), { recursive: true })
await sharp(svg, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(outPath)
