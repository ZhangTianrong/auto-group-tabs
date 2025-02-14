import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extensionDir = path.resolve(__dirname, '..', 'extension')

// Find and log all instances of -ms-high-contrast
const mediaQueryRegexes = [
  // Combined forced-colors and -ms-high-contrast
  /@media\s+(?:screen\s+and\s+)?\(\s*forced-colors\s*:\s*active\s*\)\s*,\s*\(\s*-ms-high-contrast\s*:\s*active\s*\)/g,
  // -ms-high-contrast by itself
  /@media\s+(?:screen\s+and\s+)?\(\s*-ms-high-contrast\s*:\s*[^)]+\)/g,
  // -ms-high-contrast-adjust property
  /-ms-high-contrast-adjust\s*:\s*[^;]+;/g
]

async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    let updatedContent = content

    // Apply all replacements
    for (const regex of mediaQueryRegexes) {
      updatedContent = updatedContent.replace(regex, match => {
        if (
          match.includes('forced-colors') &&
          match.includes('-ms-high-contrast')
        ) {
          return '@media screen and (forced-colors: active)'
        }
        // Remove standalone -ms-high-contrast media queries and properties
        return ''
      })
    }

    if (content !== updatedContent) {
      await fs.writeFile(filePath, updatedContent, 'utf8')
      console.log(`Processed and updated: ${filePath}`)
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error)
  }
}

async function processDirectory() {
  try {
    const files = await fs.readdir(extensionDir)

    // Process all JS files
    const jsFiles = files.filter(file => file.endsWith('.js'))

    for (const file of jsFiles) {
      await processFile(path.join(extensionDir, file))
    }

    console.log('Finished processing files')
  } catch (error) {
    console.error('Error processing directory:', error)
    globalThis.process.exit(1)
  }
}

processDirectory()
