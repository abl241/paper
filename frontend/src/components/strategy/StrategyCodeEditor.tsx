import Editor, { type OnMount } from "@monaco-editor/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { resolveApiIdFromToken } from "../../strategy/apiCatalog";
import { STRATEGY_API_DTS } from "../../strategy/strategyApiDts";

export interface StrategyCodeEditorHandle {
  insertText: (text: string) => void;
  focus: () => void;
}

interface StrategyCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onApiSymbol?: (apiId: string | null) => void;
}

let apiLibRegistered = false;

function wordAtPosition(
  model: MonacoEditor.ITextModel,
  position: { lineNumber: number; column: number },
): string {
  const line = model.getLineContent(position.lineNumber);
  const col = position.column - 1;
  let start = col;
  let end = col;
  while (start > 0 && /[\w.]/.test(line[start - 1])) start -= 1;
  while (end < line.length && /[\w.]/.test(line[end])) end += 1;
  return line.slice(start, end);
}

const StrategyCodeEditor = forwardRef<
  StrategyCodeEditorHandle,
  StrategyCodeEditorProps
>(function StrategyCodeEditor(
  { value, onChange, readOnly = false, onApiSymbol },
  ref,
) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onApiSymbolRef = useRef(onApiSymbol);
  onApiSymbolRef.current = onApiSymbol;
  const disposeCursorRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      if (!selection) {
        editor.trigger("api-explorer", "type", { text });
        return;
      }
      editor.executeEdits("api-explorer", [
        {
          range: selection,
          text,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
    },
    focus() {
      editorRef.current?.focus();
    },
  }));

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      disposeCursorRef.current?.();
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (!apiLibRegistered) {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        lib: ["es2020"],
      });
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        STRATEGY_API_DTS,
        "ts:strategy-api.d.ts",
      );
      apiLibRegistered = true;
    }

    const emitSymbol = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const model = editor.getModel();
        const position = editor.getPosition();
        if (!model || !position) {
          onApiSymbolRef.current?.(null);
          return;
        }
        const token = wordAtPosition(model, position);
        onApiSymbolRef.current?.(resolveApiIdFromToken(token));
      }, 150);
    };

    const disposable = editor.onDidChangeCursorPosition(emitSymbol);
    disposeCursorRef.current = () => disposable.dispose();
    emitSymbol();
    editor.focus();
  };

  return (
    <Editor
      language="typescript"
      theme="vs"
      height="100%"
      value={value}
      path="strategy.ts"
      onChange={(next) => onChange(next ?? "")}
      onMount={handleMount}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        padding: { top: 12, bottom: 12 },
        lineNumbers: "on",
        renderLineHighlight: "line",
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          alwaysConsumeMouseWheel: false,
        },
      }}
      loading={
        <div style={{ padding: "1rem", color: "#5b6b7c" }}>Loading editor…</div>
      }
    />
  );
});

export default StrategyCodeEditor;
