import type { Meal, WeeklyPlan } from '../types'

export interface ExportedData {
  version: 1
  exportedAt: string
  meals: Meal[]
  plans: WeeklyPlan[]
}

export function buildExport(meals: Meal[], plans: WeeklyPlan[]): ExportedData {
  return { version: 1, exportedAt: new Date().toISOString(), meals, plans }
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

export function parseImport(text: string): { meals: Meal[]; plans: WeeklyPlan[] } {
  const parsed: unknown = JSON.parse(text)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as ExportedData).meals) ||
    !Array.isArray((parsed as ExportedData).plans)
  ) {
    throw new Error('This file does not look like a DinnerDesigner export.')
  }
  const data = parsed as ExportedData
  return { meals: data.meals, plans: data.plans }
}
