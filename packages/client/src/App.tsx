import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'

function App() {
  const editor = useEditor({
    extensions: [Document, Paragraph, Text, Bold, Italic],
    content: '<p>Start typing here.</p>',
    onTransaction: ({ transaction }) => {
      if (transaction.docChanged) {
        console.log(
          'steps:',
          transaction.steps.map((step) => step.toJSON()),
        )
      }
    },
  })

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