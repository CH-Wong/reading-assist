import { useRef, useCallback, useEffect } from 'react';

interface TextEditorProps {
  value: string;
  onChange: (text: string) => void;
  onSelectionChange: (selectedText: string, range: { start: number; end: number } | null) => void;
}

export default function TextEditor({ value, onChange, onSelectionChange }: TextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value changes (e.g. OCR text, paste, clear) into the editable div.
  // We skip syncing when the change originated from user typing inside the editor
  // to avoid disrupting cursor position.
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChange.current) {
      // This re-render was triggered by our own onChange — content already matches
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      onSelectionChange('', null);
      return;
    }

    // Calculate the character offset within the editor
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    const end = start + selectedText.length;

    onSelectionChange(selectedText, { start, end });
  }, [onSelectionChange]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [handleSelection]);

  const syncToParent = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    syncToParent();
    editorRef.current?.focus();
  };

  const handleInput = () => {
    syncToParent();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    syncToParent();
  };

  return (
    <div className="text-editor-wrapper">
      <div className="editor-toolbar">
        <button
          className="toolbar-btn"
          onClick={() => execCommand('bold')}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => execCommand('italic')}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          className="toolbar-btn"
          onClick={() => execCommand('underline')}
          title="Underline"
        >
          <u>U</u>
        </button>
        <span className="toolbar-separator" />
        <button
          className="toolbar-btn"
          onClick={() => execCommand('formatBlock', '<h2>')}
          title="Heading"
        >
          H
        </button>
        <button
          className="toolbar-btn"
          onClick={() => execCommand('insertUnorderedList')}
          title="Bullet list"
        >
          • List
        </button>
        <button
          className="toolbar-btn"
          onClick={() => execCommand('removeFormat')}
          title="Clear formatting"
        >
          ✕ Clear
        </button>
      </div>
      <div
        ref={editorRef}
        className="editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder="Paste or type your foreign language text here..."
      />
    </div>
  );
}
