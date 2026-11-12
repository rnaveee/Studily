import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function normalizeMath(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => `$${body.trim()}$`)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`);
}

const codeStyle = { background: "var(--surface-hi)" };

const components: Components = {
  h1: (props) => <h3 className="mt-1 text-[15.5px] font-semibold text-fg" {...strip(props)} />,
  h2: (props) => <h3 className="mt-1 text-[15px] font-semibold text-fg" {...strip(props)} />,
  h3: (props) => <h4 className="mt-1 text-[14.5px] font-semibold text-fg" {...strip(props)} />,
  h4: (props) => <h4 className="text-[14px] font-semibold text-fg" {...strip(props)} />,
  strong: (props) => <strong className="font-semibold text-fg" {...strip(props)} />,
  ul: (props) => <ul className="list-disc space-y-1 pl-5 marker:text-fg-3" {...strip(props)} />,
  ol: (props) => <ol className="list-decimal space-y-1 pl-5 marker:text-fg-3" {...strip(props)} />,
  blockquote: (props) => (
    <blockquote className="border-l-2 pl-3 text-fg-2" style={{ borderColor: "var(--accent)" }} {...strip(props)} />
  ),
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2" />
  ),
  hr: () => <hr className="border-line" />,
  pre: (props) => (
    <pre
      className="overflow-x-auto rounded-lg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed [&>code]:bg-transparent [&>code]:p-0"
      style={codeStyle}
      {...strip(props)}
    />
  ),
  code: (props) => (
    <code className="rounded px-1 py-px font-mono text-[12.5px]" style={codeStyle} {...strip(props)} />
  ),
  table: (props) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" {...strip(props)} />
    </div>
  ),
  th: (props) => (
    <th className="border-b border-line px-2.5 py-1.5 text-left font-semibold text-fg" {...strip(props)} />
  ),
  td: (props) => <td className="border-b border-line px-2.5 py-1.5 align-top" {...strip(props)} />,
};

function strip<T extends { node?: unknown }>({ node: _node, ...rest }: T): Omit<T, "node"> {
  return rest;
}

export default function MarkdownRenderer({ text, ...rest }: { text: string } & ComponentPropsWithoutRef<"div">) {
  return (
    <div {...rest} className={`bot-md space-y-2.5 break-words ${rest.className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", output: "htmlAndMathml" }]]}
        components={components}
      >
        {normalizeMath(text)}
      </ReactMarkdown>
    </div>
  );
}
