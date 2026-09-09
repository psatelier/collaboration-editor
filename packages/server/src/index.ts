import { WebSocketServer, type WebSocket } from 'ws'

const PORT = 8080

const wss = new WebSocketServer({ port: PORT })
const clients = new Set<WebSocket>()

wss.on('connection', (socket) => {
  console.log('Client connected')
  clients.add(socket)

  socket.on('message', (data) => {
    const message = data.toString()
    console.log('Relaying op:', message)
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
