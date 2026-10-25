import { useState } from 'react'
import type { ComponentProps } from 'react'

type NumberInputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: number
  /** Called with each edit that parses as a finite number. */
  onCommit: (n: number) => void
  /** `decimal` (quantities) or `numeric` (whole counts) on-screen keyboard. */
  inputMode?: 'decimal' | 'numeric'
}

/** A number field that keeps its own text while being edited, so clearing it
 * to retype doesn't snap it to 0 — a value is only committed when it parses
 * as a number, and the field shows the stored value again once it loses
 * focus. */
export function NumberInput({ value, onCommit, onBlur, inputMode = 'decimal', ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...rest}
      type="number"
      inputMode={inputMode}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n)
      }}
      onBlur={(e) => {
        setDraft(null)
        onBlur?.(e)
      }}
    />
  )
}
