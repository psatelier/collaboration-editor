import { WebSocketServer } from 'ws'

const PORT = 8080

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (socket) => {
  console.log('Client connected')

  socket.send('hello from server')

  socket.on('message', (data) => {
    console.log('Received from client:', data.toString())
  })

  socket.on('close', () => {
    console.log('Client disconnected')
  })
})

console.log(`WebSocket server listening on ws://localhost:${PORT}`)
