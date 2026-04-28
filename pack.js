import { createWriteStream } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const output = createWriteStream(resolve(__dirname, 'tabgroup-automata.zip'))
const archive = archiver('zip')

output.on('close', () => {
  console.log('Extension has been packed')
})

archive.on('error', error => {
  throw error
})

archive.pipe(output)

archive.directory(resolve(__dirname, 'extension'), false, data => {
  if (['.DS_Store', 'thumbs.db', 'desktop.ini'].includes(data.name)) {
    return false
  }
  return data
})

archive.finalize()
