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

console.log('\n--- Mark convergence test ---')

const markReplicaA = new RgaText('A')
const sharedOps = typeString(markReplicaA, 'Hi')

const markReplicaB = new RgaText('B')
for (const op of sharedOps) markReplicaB.applyRemote(op)

console.log('Replica A before marks:', markReplicaA.toRichText())
console.log('Replica B before marks:', markReplicaB.toRichText())

const boldOnOps = markReplicaA.localSetMark(0, 1, 'bold', true)
const boldOffOps = markReplicaB.localSetMark(0, 1, 'bold', false)

for (const op of boldOffOps) markReplicaA.applyRemote(op)
for (const op of boldOnOps) markReplicaB.applyRemote(op)

console.log('Replica A after conflicting bold ops:', markReplicaA.toRichText())
console.log('Replica B after conflicting bold ops:', markReplicaB.toRichText())

const marksConverged =
  JSON.stringify(markReplicaA.toRichText()) === JSON.stringify(markReplicaB.toRichText())
console.log(marksConverged ? '✅ Mark state converged.' : '❌ Mark divergence detected!')