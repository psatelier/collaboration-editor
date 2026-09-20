import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import { RgaText, type CrdtOp } from '@collaboration-editor/shared'
import { stepToOps, applyRemoteOp } from './prosemirrorBridge'

const STORAGE_KEY = 'collaboration-editor-doc'

function App() {
  const savedDoc = localStorage.getItem(STORAGE_KEY)

  const crdtRef = useRef<RgaText | null>(null)
  if (crdtRef.current === null) {
    crdtRef.current = new RgaText(crypto.randomUUID())
  }

  const socketRef = useRef<WebSocket | null>(null)

  const editor = useEditor({
    extensions: [Document, Paragraph, Text, Bold, Italic],
    content: savedDoc ? JSON.parse(savedDoc) : '<p>Start typing here.</p>',
    onUpdate: ({ editor, transaction }) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editor.state.doc.toJSON()))

      if (transaction.getMeta('remote')) {
        return
      }

      const socket = socketRef.current
      for (const step of transaction.steps) {
        const ops = stepToOps(crdtRef.current!, step.toJSON())
        if (socket && socket.readyState === WebSocket.OPEN) {
          for (const op of ops) {
            socket.send(JSON.stringify(op))
          }
        }
      }
    },
  })

  const editorRef = useRef(editor)
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080')
    socketRef.current = socket

    socket.addEventListener('message', (event) => {
      const op: CrdtOp = JSON.parse(event.data)
      applyRemoteOp(crdtRef.current!, editorRef.current, op)
    })

    return () => {
      socket.close()
    }
  }, [])

  if (!editor) {
    return null
  }

  return (
    <div>
      <div>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default App