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
    "flex h-full flex-col border-r border-gemini-border bg-gemini-bg transition-all duration-300",
    collapsed ? "w-0 overflow-hidden" : "w-64"
  );

  return (
    <aside className={containerClasses} aria-hidden={collapsed}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-bold">
            S
          </div>
          <span className="text-lg font-medium text-gemini-text">Sudar AI</span>
        </div>
        <button
          type="button"
          onClick={onCreateChat}
          className="rounded-lg p-1.5 text-gemini-textSoft transition hover:bg-gemini-surface hover:text-gemini-text"
          title="New chat"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="px-4 py-8">
            <LoadingSpinner label="Loading chats" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gemini-textSoft">
            No recent chats
          </div>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => (
              <li key={chat.chat_id}>
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.chat_id)}
                  className={clsx(
                    "group relative w-full rounded-lg p-3 text-left transition",
                    activeChatId === chat.chat_id
                      ? "bg-gemini-surface text-gemini-text"
                      : "text-gemini-textSoft hover:bg-gemini-surface/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <svg className="mt-1 h-4 w-4 flex-shrink-0 text-gemini-textSoft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {chat.chat_name || `Chat ${chat.chat_id}`}
                      </p>
                      <p className="mt-0.5 text-xs text-gemini-textSoft">
                        {dayjs(chat.last_message_time ?? chat.first_message_time).format("MMM D")}
                      </p>
                    </div>
                  </div>
                  {activeChatId === chat.chat_id && (
                    <div className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gemini-accent"></div>
                  )}
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
