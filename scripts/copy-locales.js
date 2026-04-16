import { cpSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const sourceDir = resolve(import.meta.dirname, '..', 'src', 'static', '_locales')
const targetDir = resolve(import.meta.dirname, '..', 'extension', '_locales')

if (!existsSync(sourceDir)) {
  throw new Error(`Locale source directory not found: ${sourceDir}`)
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceDir, targetDir, { recursive: true, force: true })
