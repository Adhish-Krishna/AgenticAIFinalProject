import { FC, useState, useEffect, useRef } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import type { ChatSummary } from "../api/types";
import LoadingSpinner from "./LoadingSpinner";

interface ChatListProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onUpdateChatName?: (chatId: string, chatName: string) => Promise<void>;
  onDeleteChat?: (chatId: string) => Promise<void>;
  isLoading?: boolean;
  collapsed?: boolean;
  isUpdatingChatName?: boolean;
  isDeletingChat?: boolean;
}

const ChatList: FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onCreateChat,
  onUpdateChatName,
  onDeleteChat,
  isLoading,
  collapsed = false,
  isUpdatingChatName = false,
  isDeletingChat = false,
}: ChatListProps) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState<string>("");
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuChatId) {
        setOpenMenuChatId(null);
      }
    };

    if (openMenuChatId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuChatId]);

  const containerClasses = clsx(
    "flex h-full flex-col border-r border-gemini-border bg-gemini-bg transition-all duration-300",
    collapsed ? "w-0 overflow-hidden" : "w-64"
  );

  const handleStartEditing = (chatId: string, currentName: string) => {
    setEditingChatId(chatId);
    setEditingChatName(currentName || "");
  };

  const handleCancelEditing = () => {
    setEditingChatId(null);
    setEditingChatName("");
  };

  const handleSaveEdit = async (chatId: string) => {
    if (!onUpdateChatName || !editingChatName.trim()) return;
    
    try {
      await onUpdateChatName(chatId, editingChatName.trim());
      setEditingChatId(null);
      setEditingChatName("");
    } catch (error) {
      console.error("Failed to update chat name:", error);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!onDeleteChat) return;
    
    try {
      await onDeleteChat(chatId);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  return (
    <aside className={containerClasses} aria-hidden={collapsed}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-bold">
            T
          </div>
          <span className="text-lg font-medium text-gemini-text">Teach Assist</span>
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
              <li key={chat.chat_id} className="group relative">
                {editingChatId === chat.chat_id ? (
                  <div className="rounded-lg border border-gemini-border bg-gemini-surface p-3">
                    <input
                      type="text"
                      value={editingChatName}
                      onChange={(e) => setEditingChatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveEdit(chat.chat_id);
                        } else if (e.key === "Escape") {
                          handleCancelEditing();
                        }
                      }}
                      className="w-full bg-transparent text-sm text-gemini-text placeholder-gemini-textSoft focus:outline-none"
                      placeholder="Chat name"
                      autoFocus
                      disabled={isUpdatingChatName}
                    />
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(chat.chat_id)}
                        disabled={isUpdatingChatName || !editingChatName.trim()}
                        className="rounded p-1 text-xs text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                        title="Save"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditing}
                        disabled={isUpdatingChatName}
                        className="rounded p-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        title="Cancel"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuChatId(null);
                        onSelectChat(chat.chat_id);
                      }}
                      className={clsx(
                        "relative w-full rounded-lg p-3 text-left transition",
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
                    </button>
                    
                    {/* Three-dot menu */}
                    <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuChatId(openMenuChatId === chat.chat_id ? null : chat.chat_id);
                          }}
                          className="rounded-full p-1 text-gemini-textSoft hover:bg-gemini-border hover:text-gemini-text"
                          title="More options"
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>
                        
                        {/* Dropdown menu */}
                        {openMenuChatId === chat.chat_id && (
                          <div className="absolute right-0 top-8 z-50 w-32 rounded-lg border border-gemini-border bg-gemini-surface py-1 shadow-lg">
                            {onUpdateChatName && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuChatId(null);
                                  handleStartEditing(chat.chat_id, chat.chat_name || `Chat ${chat.chat_id}`);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gemini-text hover:bg-gemini-border"
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                            )}
                            {onDeleteChat && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuChatId(null);
                                  handleDeleteChat(chat.chat_id);
                                }}
                                disabled={isDeletingChat}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default ChatList;
