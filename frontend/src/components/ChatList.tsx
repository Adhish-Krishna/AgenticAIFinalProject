import { FC } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import type { ChatSummary } from "../api/types";
import LoadingSpinner from "./LoadingSpinner";

interface ChatListProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  isLoading?: boolean;
  collapsed?: boolean;
}

const ChatList: FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onCreateChat,
  isLoading,
  collapsed = false,
}: ChatListProps) => {
  const containerClasses = clsx(
    "flex flex-col border-r border-slate-800 bg-slate-900/70 transition-all duration-200",
    collapsed ? "w-0 overflow-hidden" : "w-80"
  );

  return (
    <aside className={containerClasses} aria-hidden={collapsed}>
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Your Chats</h2>
          <p className="text-xs text-slate-500">Pick a conversation or start fresh</p>
        </div>
        <button
          type="button"
          onClick={onCreateChat}
          className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow transition hover:bg-brand-500"
        >
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-6 py-8">
            <LoadingSpinner label="Loading chats" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">No chats yet. Click New to begin.</div>
        ) : (
          <ul className="space-y-1 px-4 py-3">
            {chats.map((chat) => (
              <li key={chat.chat_id}>
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.chat_id)}
                  className={clsx(
                    "w-full rounded-lg border px-4 py-3 text-left transition",
                    activeChatId === chat.chat_id
                      ? "border-brand-500 bg-brand-600/20 text-white"
                      : "border-transparent bg-slate-800/60 text-slate-200 hover:border-slate-700 hover:bg-slate-800"
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{dayjs(chat.last_message_time ?? chat.first_message_time).format("MMM D, HH:mm")}</span>
                    <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      #{chat.chat_id}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {chat.chat_name || `Conversation ${chat.chat_id}`}
                  </p>
                  <p className="text-xs text-slate-400">{chat.message_count} messages</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default ChatList;
