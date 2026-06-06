import { db } from '@/lib/db'
import { appLogs } from '@/lib/db/schema'

type LogAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'error' | 'view'

export async function log(
  action: LogAction,
  entityType: string,
  entityId?: string,
  message?: string,
  userId?: string
) {
  try {
    await db.insert(appLogs).values({
      action,
      entityType,
      entityId: entityId ?? null,
      message: message ?? null,
      createdBy: userId ?? null,
    })
  } catch (e) {
    console.error('[logger] failed to write log', e)
  }
}
