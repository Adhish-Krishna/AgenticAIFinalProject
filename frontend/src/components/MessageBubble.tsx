import { FC } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import type { AgentMessage } from "../api/types";

interface MessageBubbleProps {
  message: AgentMessage;
  isOwn?: boolean;
}

const MessageBubble: FC<MessageBubbleProps> = ({ message, isOwn = false }: MessageBubbleProps) => {
  const timestamp = dayjs(message.timestamp).format("MMM D, HH:mm");

  return (
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
              : "bg-transparent"
          )}
        >
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
      {isOwn && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gemini-border text-gemini-textSoft text-sm">
          A
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
