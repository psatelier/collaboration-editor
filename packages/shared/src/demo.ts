import { RgaText, type CrdtOp } from './crdt.ts'

function typeString(doc: RgaText, text: string): CrdtOp[] {
  const ops: CrdtOp[] = []
  for (let i = 0; i < text.length; i++) {
    ops.push(doc.localInsert(i, text[i]))
  }
  return ops
}

const replicaA = new RgaText('A')
const replicaB = new RgaText('B')

const opsFromA = typeString(replicaA, 'Hi')
const opsFromB = typeString(replicaB, 'Yo')

console.log('Replica A after typing locally:', replicaA.toString())
console.log('Replica B after typing locally:', replicaB.toString())

for (const op of opsFromB) replicaA.applyRemote(op)
for (const op of opsFromA) replicaB.applyRemote(op)

console.log("Replica A after receiving B's ops:", replicaA.toString())
console.log("Replica B after receiving A's ops:", replicaB.toString())

const replicaC = new RgaText('C')
const shuffledOps = [opsFromB[0], opsFromA[0], opsFromB[1], opsFromA[1]]
for (const op of shuffledOps) replicaC.applyRemote(op)

console.log('Replica C (all 4 ops applied in a shuffled order):', replicaC.toString())

const converged =
  replicaA.toString() === replicaB.toString() && replicaB.toString() === replicaC.toString()
console.log(converged ? '✅ All three replicas converged.' : '❌ Divergence detected!')