export type SiteId = string

export interface CharId {
  site: SiteId
  counter: number
}

export type MarkType = 'bold' | 'italic'

export interface InsertOp {
  type: 'insert'
  id: CharId
  char: string
  parentId: CharId | null
}

export interface DeleteOp {
  type: 'delete'
  id: CharId
}

export interface MarkOp {
  type: 'mark'
  target: CharId
  mark: MarkType
  value: boolean
  timestamp: CharId
}

export type CrdtOp = InsertOp | DeleteOp | MarkOp

interface MarkState {
  value: boolean
  timestamp: CharId
}

interface CrdtNode {
  id: CharId
  char: string
  deleted: boolean
  children: CrdtNode[]
  marks: Map<MarkType, MarkState>
}

// Every replica must agree on this ordering for concurrent siblings (and concurrent
// mark writes on the same character), or they won't converge.
function hasHigherPriority(a: CharId, b: CharId): boolean {
  if (a.counter !== b.counter) return a.counter > b.counter
  return a.site > b.site
}

export class RgaText {
  private counter = 0
  private root: CrdtNode = {
    id: { site: '', counter: -1 },
    char: '',
    deleted: true,
    children: [],
    marks: new Map(),
  }
  private nodesById = new Map<string, CrdtNode>()

  constructor(private siteId: SiteId) {}

  private key(id: CharId): string {
    return `${id.site}:${id.counter}`
  }

  private nextId(): CharId {
    return { site: this.siteId, counter: this.counter++ }
  }

  localInsert(visibleIndex: number, char: string): InsertOp {
    const parentId = this.idAtVisibleIndex(visibleIndex - 1)
    const op: InsertOp = { type: 'insert', id: this.nextId(), char, parentId }
    this.applyInsert(op)
    return op
  }

  localDelete(visibleIndex: number): DeleteOp {
    const id = this.idAtVisibleIndex(visibleIndex)
    if (!id) {
      throw new Error(`no character at visible index ${visibleIndex}`)
    }
    const op: DeleteOp = { type: 'delete', id }
    this.applyDelete(op)
    return op
  }

  localSetMark(startIndex: number, endIndex: number, mark: MarkType, value: boolean): MarkOp[] {
    const ops: MarkOp[] = []
    for (let i = startIndex; i < endIndex; i++) {
      const target = this.idAtVisibleIndex(i)
      if (!target) continue
      const op: MarkOp = { type: 'mark', target, mark, value, timestamp: this.nextId() }
      this.applyMark(op)
      ops.push(op)
    }
    return ops
  }

  applyRemote(op: CrdtOp) {
    if (op.type === 'insert') {
      this.applyInsert(op)
    } else if (op.type === 'delete') {
      this.applyDelete(op)
    } else {
      this.applyMark(op)
    }
  }

  toString(): string {
    let result = ''
    const visit = (node: CrdtNode) => {
      if (node !== this.root && !node.deleted) {
        result += node.char
      }
      for (const child of node.children) {
        visit(child)
      }
    }
    visit(this.root)
    return result
  }

  toRichText(): Array<{ char: string; marks: MarkType[] }> {
    const result: Array<{ char: string; marks: MarkType[] }> = []
    const visit = (node: CrdtNode) => {
      if (node !== this.root && !node.deleted) {
        const activeMarks: MarkType[] = []
        for (const [mark, state] of node.marks) {
          if (state.value) activeMarks.push(mark)
        }
        result.push({ char: node.char, marks: activeMarks })
      }
      for (const child of node.children) {
        visit(child)
      }
    }
    visit(this.root)
    return result
  }

  visibleIndexOf(id: CharId): number | null {
    let count = -1
    let found: number | null = null

    const visit = (node: CrdtNode) => {
      if (found !== null) return
      if (node !== this.root && !node.deleted) {
        count++
        if (node.id.site === id.site && node.id.counter === id.counter) {
          found = count
          return
        }
      }
      for (const child of node.children) {
        if (found !== null) return
        visit(child)
      }
    }

    visit(this.root)
    return found
  }

  getMark(id: CharId, mark: MarkType): boolean {
    const node = this.nodesById.get(this.key(id))
    return node?.marks.get(mark)?.value ?? false
  }

  private applyInsert(op: InsertOp) {
    if (this.nodesById.has(this.key(op.id))) {
      return
    }

    // Operations must arrive in causal order -- a node can't be inserted before its parent
    // exists. Our Phase 3 relay server happens to guarantee this; see Phase 5 notes.
    const parent = op.parentId ? this.nodesById.get(this.key(op.parentId)) : this.root
    if (!parent) {
      throw new Error('parent not found -- operation arrived before its parent')
    }

    const node: CrdtNode = {
      id: op.id,
      char: op.char,
      deleted: false,
      children: [],
      marks: new Map(),
    }
    this.nodesById.set(this.key(op.id), node)

    const insertAt = parent.children.findIndex((sibling) => !hasHigherPriority(sibling.id, op.id))
    if (insertAt === -1) {
      parent.children.push(node)
    } else {
      parent.children.splice(insertAt, 0, node)
    }
  }

  private applyDelete(op: DeleteOp) {
    const node = this.nodesById.get(this.key(op.id))
    if (node) {
      node.deleted = true
    }
  }

  private applyMark(op: MarkOp) {
    const node = this.nodesById.get(this.key(op.target))
    if (!node) {
      throw new Error('mark target not found -- operation arrived before its target')
    }

    const current = node.marks.get(op.mark)
    if (!current || hasHigherPriority(op.timestamp, current.timestamp)) {
      node.marks.set(op.mark, { value: op.value, timestamp: op.timestamp })
    }
  }

  private idAtVisibleIndex(visibleIndex: number): CharId | null {
    if (visibleIndex < 0) {
      return null
    }

    let count = -1
    let found: CharId | null = null

    const visit = (node: CrdtNode) => {
      if (found) return
      if (node !== this.root && !node.deleted) {
        count++
        if (count === visibleIndex) {
          found = node.id
          return
        }
      }
      for (const child of node.children) {
        if (found) return
        visit(child)
      }
    }

    visit(this.root)
    return found
  }
}