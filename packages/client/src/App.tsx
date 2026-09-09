import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import { CrdtTextarea } from './CrdtTextarea'

const STORAGE_KEY = 'collaboration-editor-doc'

function App() {
  const savedDoc = localStorage.getItem(STORAGE_KEY)

  const editor = useEditor({
    extensions: [Document, Paragraph, Text, Bold, Italic],
    content: savedDoc ? JSON.parse(savedDoc) : '<p>Start typing here.</p>',
    onUpdate: ({ editor }) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editor.state.doc.toJSON()))
    },
  })

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080')

    socket.addEventListener('open', () => {
      console.log('Connected to server')
      socket.send('hello from client')
    })

    socket.addEventListener('message', (event) => {
      console.log('Received from server:', event.data)
    })

    socket.addEventListener('close', () => {
      console.log('Disconnected from server')
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
      <hr />
      <CrdtTextarea />
    </div>
  )
}

export default App