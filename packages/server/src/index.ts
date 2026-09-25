import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import { RgaText, type CrdtOp, type SerializedNode } from '@collaboration-editor/shared'

const PORT = 8080
const DATA_FILE = fileURLToPath(new URL('../data/document.json', import.meta.url))

function loadDocument(): RgaText {
  if (existsSync(DATA_FILE)) {
    const nodes: SerializedNode[] = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    console.log(`Loaded existing document (${nodes.length} nodes) from disk`)
    return RgaText.deserialize('server', nodes)
  }
  console.log('No existing document found -- starting fresh')
  return new RgaText('server')
}

function saveDocument(doc: RgaText) {
  mkdirSync(dirname(DATA_FILE), { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(doc.serialize()))
}

const document = loadDocument()
const wss = new WebSocketServer({ port: PORT })
const clients = new Set<WebSocket>()

wss.on('connection', (socket) => {
  console.log('Client connected')
  clients.add(socket)

  socket.on('message', (data) => {
    const message = data.toString()
    const op: CrdtOp = JSON.parse(message)

    document.applyRemote(op)
    saveDocument(document)

    for (const client of clients) {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(message)
      }
    }
  })

  socket.on('close', () => {
    console.log('Client disconnected')
    clients.delete(socket)
  })
})

console.log(`WebSocket server listening on ws://localhost:${PORT}`)
