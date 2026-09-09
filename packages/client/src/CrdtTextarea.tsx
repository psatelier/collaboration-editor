import { useEffect, useRef, useState, type ChangeEvent } from 'react'
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
  const docRef = useRef<RgaText | null>(null)
  if (docRef.current === null) {
    docRef.current = new RgaText(crypto.randomUUID())
  }

  const socketRef = useRef<WebSocket | null>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080')
    socketRef.current = socket

    socket.addEventListener('message', (event) => {
      const op: CrdtOp = JSON.parse(event.data)
      console.log('Received op:', op)
      docRef.current!.applyRemote(op)
      setValue(docRef.current!.toString())
    })

    return () => {
      socket.close()
    }
  }, [])

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value
    const ops = diffToOps(docRef.current!, value, newValue)
    console.log('Sending ops:', ops)

    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      for (const op of ops) {
        socket.send(JSON.stringify(op))
      }
    } else {
      console.warn('Not connected — these ops stay local for now:', ops)
    }

    setValue(docRef.current!.toString())
  }

  return (
    <div>
      <h3>Phase 5 CRDT test area</h3>
      <textarea value={value} onChange={handleChange} rows={6} cols={50} />
    </div>
  )
}
