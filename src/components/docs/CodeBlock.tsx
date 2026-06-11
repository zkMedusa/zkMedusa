"use client";

import { useCallback, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  title?: string;
  code: string;
  language?: string;
}

function resolveLanguage(language: string): string {
  const map: Record<string, string> = {
    typescript: "tsx",
    ts: "tsx",
    tsx: "tsx",
    bash: "bash",
    shell: "bash",
    env: "bash",
    json: "json",
    url: "plaintext",
    hex: "plaintext",
    plaintext: "plaintext",
  };

  return map[language.toLowerCase()] ?? "tsx";
}

const codeTheme = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: "#0d0d0d",
    margin: 0,
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: "transparent",
  },
};

export default function CodeBlock({
  title,
  code,
  language = "typescript",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const prismLanguage = resolveLanguage(language);
  const codeToCopy = code.trimEnd();

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [codeToCopy]);

  return (
    <div className="normal-case border border-white/20 overflow-hidden group">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/20 bg-[#1e1e1e]">
        <div className="font-mono text-xs text-[#cccccc] truncate min-w-0">
          {title ? (
            <>
              {title}
              {language && (
                <span className="text-[#858585]"> · {language}</span>
              )}
            </>
          ) : (
            language && <span className="text-[#858585]">{language}</span>
          )}
        </div>
        <button
          type="button"
          onClick={copyCode}
          aria-label={copied ? "Copied" : "Copy code"}
          className="shrink-0 px-2.5 py-1 border border-white/20 text-[11px] font-mono text-[#cccccc] hover:bg-white/10 hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={prismLanguage}
        style={codeTheme}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "#0d0d0d",
          fontSize: "0.8125rem",
          lineHeight: "1.6",
          textTransform: "none",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              'Menlo, Monaco, Consolas, "Courier New", monospace',
          },
        }}
        showLineNumbers={code.split("\n").length > 6}
        lineNumberStyle={{
          color: "#858585",
          minWidth: "2.75em",
          paddingRight: "1em",
          userSelect: "none",
        }}
        wrapLongLines
      >
        {codeToCopy}
      </SyntaxHighlighter>
    </div>
  );
}
