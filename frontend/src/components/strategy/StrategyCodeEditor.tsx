import Editor, { type OnMount } from "@monaco-editor/react";
import { STRATEGY_API_DTS } from "../../strategy/strategyApiDts";

interface StrategyCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

let apiLibRegistered = false;

const handleMount: OnMount = (editor, monaco) => {
  if (!apiLibRegistered) {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
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
  editor.focus();
};

export default function StrategyCodeEditor({
  value,
  onChange,
  readOnly = false,
}: StrategyCodeEditorProps) {
  return (
    <Editor
      language="typescript"
      theme="vs"
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
        },
      }}
      loading={<div style={{ padding: "1rem", color: "#5b6b7c" }}>Loading editor…</div>}
    />
  );
}
