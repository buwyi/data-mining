import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { r } from '@codemirror/legacy-modes/mode/r'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'

export type ScriptCodeLanguage = 'python' | 'sql' | 'r'

export type ScriptCodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  /** TipDM：8=pgsql，9=R，10=Python */
  language: ScriptCodeLanguage
  readOnly?: boolean
  /** 近似行数，用于估算高度 */
  rows?: number
  placeholder?: string
}

const editorShellTheme = EditorView.theme(
  {
    '&': {
      fontSize: '12px',
    },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    '.cm-content': {
      caretColor: 'var(--ant-color-text)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--ant-color-fill-quaternary, #fafafa)',
      borderRight: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
      color: 'var(--ant-color-text-secondary, rgba(0,0,0,0.45))',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
  },
  { dark: false },
)

function languageExtensions(lang: ScriptCodeLanguage) {
  switch (lang) {
    case 'sql':
      return [sql()]
    case 'r':
      return [StreamLanguage.define(r)]
    case 'python':
    default:
      return [python()]
  }
}

/** 节点脚本 / 源码：CodeMirror 语法高亮，替代等宽文本框 */
export function ScriptCodeEditor({
  value,
  onChange,
  language,
  readOnly,
  rows = 8,
  placeholder,
}: ScriptCodeEditorProps) {
  const heightPx = useMemo(() => Math.max(140, Math.min(520, rows * 22 + 24)), [rows])

  const extensions = useMemo(
    () => [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      ...languageExtensions(language),
      editorShellTheme,
      EditorView.lineWrapping,
    ],
    [language],
  )

  return (
    <div
      className="nodrag"
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(0, 0, 0, 0.15)',
        background: 'var(--ant-color-bg-container, #fff)',
      }}
    >
      <CodeMirror
        value={value}
        height={`${heightPx}px`}
        theme="light"
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={readOnly ? undefined : onChange}
      />
    </div>
  )
}
