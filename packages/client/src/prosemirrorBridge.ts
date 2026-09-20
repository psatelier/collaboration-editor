import type { Editor } from '@tiptap/core'
import { RgaText, type CrdtOp, type MarkType } from '@collaboration-editor/shared'

interface StepJSON {
  stepType: string
  from?: number
  to?: number
  slice?: {
    content?: Array<{
      type: string
      text?: string
      marks?: Array<{ type: string }>
    }>
  }
  mark?: { type: string }
}

// Valid only for our current schema: a single paragraph, no other block-level nodes.
function pmPosToVisibleIndex(pos: number): number {
  return pos - 1
}

function visibleIndexToPmPos(visibleIndex: number): number {
  return visibleIndex + 1
}

export function stepToOps(doc: RgaText, step: StepJSON): CrdtOp[] {
  const ops: CrdtOp[] = []

  if (step.stepType === 'replace' && step.from !== undefined && step.to !== undefined) {
    const from = pmPosToVisibleIndex(step.from)
    const to = pmPosToVisibleIndex(step.to)

    for (let i = from; i < to; i++) {
      ops.push(doc.localDelete(from))
    }

    let insertAt = from
    for (const node of step.slice?.content ?? []) {
      if (node.type !== 'text' || !node.text) continue
      for (const char of node.text) {
        ops.push(doc.localInsert(insertAt, char))
        for (const mark of node.marks ?? []) {
          ops.push(...doc.localSetMark(insertAt, insertAt + 1, mark.type as MarkType, true))
        }
        insertAt++
      }
    }
  } else if (
    (step.stepType === 'addMark' || step.stepType === 'removeMark') &&
    step.from !== undefined &&
    step.to !== undefined &&
    step.mark
  ) {
    const from = pmPosToVisibleIndex(step.from)
    const to = pmPosToVisibleIndex(step.to)
    ops.push(...doc.localSetMark(from, to, step.mark.type as MarkType, step.stepType === 'addMark'))
  }

  return ops
}

export function applyRemoteOp(doc: RgaText, editor: Editor | null, op: CrdtOp) {
  if (!editor) return

  if (op.type === 'insert') {
    doc.applyRemote(op)
    const visibleIndex = doc.visibleIndexOf(op.id)
    if (visibleIndex === null) return
    const tr = editor.state.tr.insertText(op.char, visibleIndexToPmPos(visibleIndex))
    tr.setMeta('remote', true)
    editor.view.dispatch(tr)
  } else if (op.type === 'delete') {
    const visibleIndex = doc.visibleIndexOf(op.id)
    doc.applyRemote(op)
    if (visibleIndex === null) return
    const pos = visibleIndexToPmPos(visibleIndex)
    const tr = editor.state.tr.delete(pos, pos + 1)
    tr.setMeta('remote', true)
    editor.view.dispatch(tr)
  } else {
    doc.applyRemote(op)
    const visibleIndex = doc.visibleIndexOf(op.target)
    if (visibleIndex === null) return
    const pos = visibleIndexToPmPos(visibleIndex)
    const value = doc.getMark(op.target, op.mark)
    const markType = editor.schema.marks[op.mark]
    const tr = value
      ? editor.state.tr.addMark(pos, pos + 1, markType.create())
      : editor.state.tr.removeMark(pos, pos + 1, markType)
    tr.setMeta('remote', true)
    editor.view.dispatch(tr)
  }
}