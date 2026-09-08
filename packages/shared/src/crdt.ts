export type SiteId = string

export interface CharId {
  site: SiteId
  counter: number
}

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

export type CrdtOp = InsertOp | DeleteOp

interface CrdtNode {
  id: CharId
  char: string
  deleted: boolean
  children: CrdtNode[]
}

function idsEqual(a: CharId, b: CharId): boolean {
  return a.site === b.site && a.counter === b.counter
}

// Every replica must agree on this ordering for concurrent siblings, or they won't converge.
function hasHigherPriority(a: CharId, b: CharId): boolean {
  if (a.counter !== b.counter) return a.counter > b.counter
  return a.site > b.site
}

export class RgaText {
  private counter = 0
  private root: CrdtNode = { id: { site: '', counter: -1 }, char: '', deleted: true, children: [] }
  private nodesById = new Map<string, CrdtNode>()

  constructor(private siteId: SiteId) {}

  private key(id: CharId): string {
    return `${id.site}:${id.counter}`
  }

  localInsert(visibleIndex: number, char: string): InsertOp {
    const parentId = this.idAtVisibleIndex(visibleIndex - 1)
    const id: CharId = { site: this.siteId, counter: this.counter++ }
    const op: InsertOp = { type: 'insert', id, char, parentId }
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

  applyRemote(op: CrdtOp) {
    if (op.type === 'insert') {
      this.applyInsert(op)
    } else {
      this.applyDelete(op)
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

  private applyInsert(op: InsertOp) {
    if (this.nodesById.has(this.key(op.id))) {
      return
    }

    // Operations must arrive in causal order -- a node can't be inserted before its parent
    // exists. Our Phase 3 relay server happens to guarantee this; more on why when we wire it up.
    const parent = op.parentId ? this.nodesById.get(this.key(op.parentId)) : this.root
    if (!parent) {
      throw new Error('parent not found -- operation arrived before its parent')
    }

    const node: CrdtNode = { id: op.id, char: op.char, deleted: false, children: [] }
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