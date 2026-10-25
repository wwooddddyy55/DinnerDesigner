import { CURRENT_SCHEMA_VERSION, normalizeAppData } from './migrations'
import type { AppData } from '../types'

export interface ExportedData extends AppData {
  /** Export file format version (the wrapper shape). */
  version: 1
  /** Data shape version of `meals`/`plans`/`staples` — see `CURRENT_SCHEMA_VERSION`. */
  schemaVersion: number
  exportedAt: string
}

export function buildExport({ meals, plans, staples }: AppData): ExportedData {
  return {
    version: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    meals,
    plans,
    staples,
  }
}

export function downloadExport(data: ExportedData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = data.exportedAt.slice(0, 10)
  a.href = url
  a.download = `dinnerdesigner-export-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Parses an export file. Old-shape records are migrated and malformed ones
 * repaired or dropped via `normalizeAppData`, so a hand-edited or
 * older-version file can't put the app (or, through sync, every device) into
 * a crashing state. A file from before staples existed imports with none. */
export function parseImport(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as ExportedData).meals) ||
    !Array.isArray((parsed as ExportedData).plans)
  ) {
    throw new Error('This file does not look like a DinnerDesigner export.')
  }
  const data = parsed as Partial<ExportedData>
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error('This export was made by a newer version of DinnerDesigner. Update the app and try again.')
  }
  return normalizeAppData(data)
}
