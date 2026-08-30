import type { MealType } from '../types'

const CELL_ID_SEP = '::'

export function cellDroppableId(personId: string, mealType: MealType, day: number): string {
  return [personId, mealType, day].join(CELL_ID_SEP)
}

export function parseCellDroppableId(id: string): { personId: string; mealType: MealType; day: number } {
  const [personId, mealType, day] = id.split(CELL_ID_SEP)
  return { personId, mealType: mealType as MealType, day: Number(day) }
}

/** A `PickedMealCard` for the same entry is rendered twice at once (desktop
 * sidebar + mobile "Pick meals" tab, both always mounted — visibility is
 * CSS-only), so each needs its own dnd-kit draggable id, or the two
 * `useDraggable` registrations for the same entry.id collide and the
 * later-mounted one silently steals the earlier one's drag node. `scope`
 * disambiguates them; `parsePickedEntryDraggableId` recovers the real
 * entry id for the store call in `onDragEnd`. */
export function pickedEntryDraggableId(scope: 'desktop' | 'mobile', entryId: string): string {
  return [scope, entryId].join(CELL_ID_SEP)
}

export function parsePickedEntryDraggableId(id: string): string {
  const sepIndex = id.indexOf(CELL_ID_SEP)
  return sepIndex === -1 ? id : id.slice(sepIndex + CELL_ID_SEP.length)
}
