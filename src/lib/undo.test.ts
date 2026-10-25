import { afterEach, describe, expect, it } from 'vitest'
import { dismissUndo, getUndoOffer, offerUndo } from './undo'

afterEach(() => dismissUndo())

describe('dismissUndo', () => {
  it('withdraws an offer by id only while it is still the current one', () => {
    const first = offerUndo('first', () => {})
    offerUndo('second', () => {})
    dismissUndo(first)
    expect(getUndoOffer()?.message).toBe('second')
  })

  it('withdraws the current offer by its id', () => {
    const id = offerUndo('only', () => {})
    dismissUndo(id)
    expect(getUndoOffer()).toBeNull()
  })
})
