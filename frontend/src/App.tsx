import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import api from "./api/client";
import type { AgentMessage, ChatMessageResponse, ChatSummary, FileMetadata, UpdateChatNameResponse, DeleteChatResponse } from "./api/types";
import ChatList from "./components/ChatList";
import ChatWindow from "./components/ChatWindow";

const USER_ID = import.meta.env.VITE_USER_ID ?? "demo-user";
const INITIAL_CHAT_ID = Number.parseInt(import.meta.env.VITE_INITIAL_CHAT_ID ?? "1", 10);

const App = () => {
  const queryClient = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const chatsQuery = useQuery<ChatSummary[]>({
    queryKey: ["chats"],
    queryFn: async () => {
      const response = await api.get<ChatSummary[]>("/api/chats");
      return response.data;
    },
  });

  const messagesQuery = useQuery<AgentMessage[]>({
    queryKey: ["messages", activeChatId],
    enabled: Boolean(activeChatId),
    queryFn: async () => {
      if (!activeChatId) return [];
      const response = await api.get<AgentMessage[]>(`/api/chats/${activeChatId}`);
      return response.data;
    },
  });

  const generatedContentQuery = useQuery<FileMetadata[]>({
    queryKey: ["generated-files", activeChatId],
    enabled: Boolean(activeChatId),
    queryFn: async () => {
      if (!activeChatId) return [];
      const response = await api.get<FileMetadata[]>(`/api/files/generated/${activeChatId}`);
      return response.data;
    },
  });
  
  const uploadedDocsQuery = useQuery<FileMetadata[]>({
    queryKey: ["uploaded-files", activeChatId],
    enabled: Boolean(activeChatId),
    queryFn: async () => {
      if (!activeChatId) return [];
      const response = await api.get<FileMetadata[]>(`/api/files/uploads/${activeChatId}`);
      return response.data;
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!activeChatId && chatsQuery.data && chatsQuery.data.length > 0) {
      setActiveChatId(chatsQuery.data[0].chat_id);
    }
  }, [activeChatId, chatsQuery.data]);

  const sendMessageMutation = useMutation<ChatMessageResponse, Error, string>({
    mutationKey: ["send-message", activeChatId],
    mutationFn: async (message: string) => {
      if (!activeChatId) throw new Error("Select a chat before sending messages");
      const response = await api.post<ChatMessageResponse>(`/api/chats/${activeChatId}/messages`, { message });
      return response.data;
    },
    onSuccess: async () => {
      if (!activeChatId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages", activeChatId] }),
        queryClient.invalidateQueries({ queryKey: ["chats"] }),
        queryClient.invalidateQueries({ queryKey: ["generated-files", activeChatId] }),
        queryClient.invalidateQueries({ queryKey: ["uploaded-files", activeChatId] }),
      ]);
    },
  });

  const uploadMutation = useMutation({
    mutationKey: ["upload", activeChatId],
    mutationFn: async (file: File) => {
      if (!activeChatId) throw new Error("Select a chat before uploading files");
      const payload = new FormData();
      payload.append("chat_id", activeChatId);
      payload.append("file", file);
      await api.post("/api/files/upload", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: async () => {
      if (!activeChatId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["generated-files", activeChatId] }),
        queryClient.invalidateQueries({ queryKey: ["uploaded-files", activeChatId] }),
      ]);
    },
  });

  const updateChatNameMutation = useMutation({
    mutationFn: async ({ chatId, chatName }: { chatId: string; chatName: string }) => {
      const response = await api.put(`/api/chats/${chatId}/name`, { chat_name: chatName });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await api.delete(`/api/chats/${chatId}`);
      return response.data;
    },
    onSuccess: async (_, chatId) => {
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      // If the deleted chat was active, switch to another chat or null
      if (activeChatId === chatId) {
        const remainingChats = (chatsQuery.data || []).filter(chat => chat.chat_id !== chatId);
        setActiveChatId(remainingChats.length > 0 ? remainingChats[0].chat_id : null);
      }
    },
  });

  const handleCreateChat = async () => {
    try {
      const response = await api.get<{ next_chat_id: string }>("/api/chats/next-id");
      const newChatId = response.data.next_chat_id ?? String(INITIAL_CHAT_ID + 1);
      setActiveChatId(newChatId);
      queryClient.setQueryData<ChatSummary[]>(["chats"], (prev: ChatSummary[] = []) => {
        const exists = prev.some((chat) => chat.chat_id === newChatId);
        if (exists) return prev;
        return [
          {
            chat_id: newChatId,
            chat_name: `Conversation ${newChatId}`,
            message_count: 0,
            first_message_time: dayjs().toISOString(),
            last_message_time: dayjs().toISOString(),
          },
          ...prev,
        ];
      });
    } catch (error) {
      console.error("Failed to create chat", error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!activeChatId) throw new Error("Select a chat first");
    await sendMessageMutation.mutateAsync(message);
  };

  const handleUpload = async (file: File) => {
    if (!activeChatId) throw new Error("Select a chat first");
    await uploadMutation.mutateAsync(file);
  };

  const handleUpdateChatName = async (chatId: string, chatName: string) => {
    try {
      await updateChatNameMutation.mutateAsync({ chatId, chatName });
    } catch (error) {
      console.error("Failed to update chat name", error);
      throw error;
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (window.confirm("Are you sure you want to delete this chat? This will permanently delete all messages, uploaded files, and generated content.")) {
      try {
        await deleteChatMutation.mutateAsync(chatId);
      } catch (error) {
        console.error("Failed to delete chat", error);
        throw error;
      }
    }
  };

  const activeMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const generatedFiles = useMemo(() => generatedContentQuery.data ?? [], [generatedContentQuery.data]);
  const uploadedDocs = useMemo(() => uploadedDocsQuery.data ?? [], [uploadedDocsQuery.data]);

  return (
    <div className="flex h-screen bg-gemini-bg text-gemini-text">
      <ChatList
        chats={chatsQuery.data ?? []}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onCreateChat={handleCreateChat}
        onUpdateChatName={handleUpdateChatName}
        onDeleteChat={handleDeleteChat}
        isLoading={chatsQuery.isLoading}
        collapsed={!sidebarOpen}
        isUpdatingChatName={updateChatNameMutation.isPending}
        isDeletingChat={deleteChatMutation.isPending}
      />
      <main className="flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b border-gemini-border bg-gemini-surface/50 px-6 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-lg border border-gemini-border bg-gemini-surface px-3 py-1.5 text-xs font-medium text-gemini-textSoft transition hover:bg-gemini-border hover:text-gemini-text"
            >
              {sidebarOpen ? "←" : "→"}
            </button>
            <div>
              <h1 className="text-xl font-medium text-gemini-text">Sudar AI</h1>
              <p className="text-xs text-gemini-textSoft">{USER_ID}</p>
            </div>
          </div>
        </header>
        <div className="h-[calc(100vh-73px)] overflow-hidden bg-gemini-bg">
          <ChatWindow
            chatId={activeChatId}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onUpload={handleUpload}
            isLoadingHistory={messagesQuery.isLoading}
            isSending={sendMessageMutation.isPending}
            uploadedDocs={uploadedDocs}
            isUploading={uploadMutation.isPending}
            generatedFiles={generatedFiles}
            userName={USER_ID}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
