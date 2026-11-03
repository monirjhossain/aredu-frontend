import fs from 'fs'
import path from 'path'

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

function findRoots(templateBody) {
  const text = templateBody.replace(/<!--[\s\S]*?-->/g, '')
  const roots = []
  let i = 0
  let depth = 0

  while (i < text.length) {
    if (text[i] !== '<') {
      i += 1
      continue
    }

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i)
      i = end === -1 ? text.length : end + 3
      continue
    }

    const close = text.startsWith('</', i)
    const rest = text.slice(i)
    const openMatch = rest.match(/^<\/?([a-zA-Z][\w-]*)/)
    if (!openMatch) {
      i += 1
      continue
    }

    const tag = openMatch[1]
    const tagEnd = text.indexOf('>', i)
    if (tagEnd === -1) break
    const fullTag = text.slice(i, tagEnd + 1)
    const selfClosing = /\/>$/.test(fullTag) || ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tag)

    if (close) {
      depth = Math.max(0, depth - 1)
    } else {
      if (depth === 0) roots.push(tag)
      if (!selfClosing) depth += 1
    }

    i = tagEnd + 1
  }

  return roots
}

const files = walk('src')
const multi = []

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const match = source.match(/<template(?:\s[^>]*)?>([\s\S]*?)<\/template>/)
  if (!match) continue
  const roots = findRoots(match[1])
  if (roots.length > 1) {
    multi.push({ file: file.replace(/\\/g, '/'), roots })
  }
}

console.log(JSON.stringify(multi, null, 2))
console.log(`multi-root files: ${multi.length}`)
