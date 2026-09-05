import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

mkdirSync(new URL('../resources/', import.meta.url), { recursive: true })

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url))
const icon = sharp(svg, { density: 384 }).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
await icon.clone().png().toFile(fileURLToPath(new URL('../resources/icon.png', import.meta.url)))

const iconBuf = await icon.clone().resize(600, 600).png().toBuffer()
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#FBFAF7' } })
  .composite([{ input: iconBuf, gravity: 'center' }])
  .png()
  .toFile(fileURLToPath(new URL('../resources/splash.png', import.meta.url)))
