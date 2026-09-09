import { useRef, useState, type ChangeEvent } from 'react'
import { RgaText, type CrdtOp } from '@collaboration-editor/shared'

function diffToOps(doc: RgaText, oldValue: string, newValue: string): CrdtOp[] {
  let start = 0
  while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
    start++
  }

  let oldEnd = oldValue.length
  let newEnd = newValue.length
  while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
    oldEnd--
    newEnd--
  }

  const ops: CrdtOp[] = []

  for (let i = start; i < oldEnd; i++) {
    ops.push(doc.localDelete(start))
  }

  for (let i = start; i < newEnd; i++) {
    ops.push(doc.localInsert(i, newValue[i]))
  }

  return ops
}

export function CrdtTextarea() {
  const docRef = useRef(new RgaText('local'))
  const [value, setValue] = useState('')

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value
    const ops = diffToOps(docRef.current, value, newValue)
    console.log('Generated ops:', ops)
    setValue(docRef.current.toString())
  }

  return (
    <div>
      <h3>Phase 5 CRDT test area</h3>
      <textarea value={value} onChange={handleChange} rows={6} cols={50} />
    </div>
  )
}
