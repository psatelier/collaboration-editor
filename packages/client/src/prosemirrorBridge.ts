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