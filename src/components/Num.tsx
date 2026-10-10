import { useState } from 'react'

type Props = {
  value: number | undefined
  onChange: (v: number | undefined) => void
  bad?: boolean
  optional?: boolean
  label: string
  placeholder?: string
  min?: number
}

/**
 * A number input that keeps the raw text while focused, so typing "1" on the way to "12" isn't reformatted.
 * An empty optional field gives undefined; an empty or unparsable required field gives NaN, which validation flags.
 */
export default function Num({ value, onChange, bad, optional, label, placeholder, min = 0 }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = value === undefined || !Number.isFinite(value) ? '' : String(value)
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={min}
      aria-label={label}
      title={label}
      className={bad ? 'bad' : undefined}
      aria-invalid={bad}
      placeholder={placeholder}
      value={draft ?? shown}
      onChange={(e) => {
        const v = e.target.value.trim()
        setDraft(e.target.value)
        onChange(v === '' ? (optional ? undefined : NaN) : Number(v))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
