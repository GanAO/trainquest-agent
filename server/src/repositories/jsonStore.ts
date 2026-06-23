import fs from 'fs'
import path from 'path'

const DATA_DIR = path.resolve(__dirname, '../../../data')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function filePath(name: string): string {
  return path.join(DATA_DIR, name)
}

export function readJson<T>(filename: string, defaultValue: T): T {
  ensureDataDir()
  const fp = filePath(filename)
  if (!fs.existsSync(fp)) {
    writeJson(filename, defaultValue)
    return defaultValue
  }
  try {
    const raw = fs.readFileSync(fp, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

export function writeJson<T>(filename: string, data: T): void {
  ensureDataDir()
  const fp = filePath(filename)
  const tmp = fp + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, fp)
}
