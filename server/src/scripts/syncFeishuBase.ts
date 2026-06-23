import 'dotenv/config'
import { runFeishuBaseSync } from '../services/feishuBaseSyncService'

try {
  const result = runFeishuBaseSync('manual_cli')
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error('[feishu:sync] failed:', (err as Error).message)
  process.exit(1)
}
