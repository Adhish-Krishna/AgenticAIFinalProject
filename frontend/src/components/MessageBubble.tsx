import { FC } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { AgentMessage } from "../api/types";

interface MessageBubbleProps {
  message: AgentMessage;
  isOwn?: boolean;
}

interface ParsedContent {
  thinking: string | null;
  mainContent: string;
}

// Function to extract thinking content from message
const parseThinkingContent = (content: string): ParsedContent => {
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/gi;
  const matches = content.match(thinkingRegex);
  
  if (!matches) {
    return {
      thinking: null,
      mainContent: content,
    };
  }

  // Extract thinking content (remove <think> tags)
  const thinking = matches
    .map(match => match.replace(/<\/?think>/gi, '').trim())
    .join('\n\n');

  // Remove thinking content from main content
  const mainContent = content.replace(thinkingRegex, '').trim();

  return {
    thinking: thinking || null,
    mainContent,
  };
};

const MessageBubble: FC<MessageBubbleProps> = ({ message, isOwn = false }: MessageBubbleProps) => {
  const timestamp = dayjs(message.timestamp).format("MMM D, HH:mm");
  const parsedContent = parseThinkingContent(message.content);

  return (
    <div className="flex flex-col gap-2">
      {/* Thinking bubble (only for AI messages with thinking content) */}
      {!isOwn && parsedContent.thinking && (
        <div className="flex w-full gap-4 justify-start">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white text-sm font-medium">
            🤔
          </div>
          <div className="max-w-2xl text-left">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-purple-400">
                Sudar AI (thinking)
              </span>
              <time className="text-xs text-gemini-textSoft">{timestamp}</time>
            </div>
            <div className="rounded-2xl bg-purple-900/20 border border-purple-500/30 px-4 py-3 text-gemini-text">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 text-purple-200">{children}</p>,
                    code: ({ children, className }) => (
                      <code className={clsx("rounded bg-purple-800/50 px-1 py-0.5 text-xs", className)}>
                        {children}
                      </code>
                    ),
                  }}
                >
                  {parsedContent.thinking}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main message bubble */}
      {parsedContent.mainContent.trim() && (
        <div className={clsx("flex w-full gap-4", isOwn ? "justify-end" : "justify-start")}>
          {!isOwn && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gemini-accent text-white text-sm font-medium">
              S
            </div>
          )}
          <div className={clsx("max-w-2xl", isOwn ? "text-right" : "text-left")}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-gemini-text">
                {isOwn ? "You" : "Sudar AI"}
              </span>
              <time className="text-xs text-gemini-textSoft">{timestamp}</time>
            </div>
            <div
              className={clsx(
                "rounded-2xl px-4 py-3 text-gemini-text",
                isOwn
                  ? "bg-gemini-surface border border-gemini-border"
                  : "bg-transparent border border-gemini-border/30"
              )}
            >
              {isOwn ? (
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {parsedContent.mainContent}
                </p>
              ) : (
                <div className="prose prose-invert prose-base max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                    h1: ({ children }) => <h1 className="mb-4 text-xl font-bold text-gemini-text">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-3 text-lg font-semibold text-gemini-text">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-2 text-base font-medium text-gemini-text">{children}</h3>,
                    code: ({ children, className }) => (
                      <code className={clsx("rounded bg-gemini-surface px-1 py-0.5 text-sm font-mono", className)}>
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="mb-3 overflow-x-auto rounded-lg bg-gemini-surface border border-gemini-border p-3 text-sm">
                        {children}
                      </pre>
                    ),
                    ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className="mb-3 border-l-2 border-gemini-accent pl-4 italic text-gemini-textSoft">
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-gemini-accent hover:underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                  >
                    {parsedContent.mainContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
          {isOwn && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gemini-border text-gemini-textSoft text-sm">
              A
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
