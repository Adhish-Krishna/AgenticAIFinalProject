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
    <div className={clsx("flex w-full gap-3", isOwn ? "justify-end" : "justify-start")}> 
      {!isOwn && (
        <div className="mt-1 h-8 w-8 rounded-full bg-brand-500/20 text-center text-xs font-semibold uppercase leading-8 text-brand-500">
          {message.agent?.slice(0, 2) ?? "AI"}
        </div>
      )}
      <div
        className={clsx(
          "max-w-xl rounded-2xl px-5 py-3 shadow-lg transition",
          isOwn
            ? "bg-brand-600 text-white shadow-brand-900/40"
            : "bg-slate-800/70 text-slate-100 shadow-slate-900/40"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {isOwn ? "You" : message.agent ?? "SUDAR"}
          </span>
          <time className="text-[10px] uppercase tracking-widest text-slate-500">{timestamp}</time>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
          {message.content}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;
