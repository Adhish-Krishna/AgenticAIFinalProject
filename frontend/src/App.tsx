import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import api from "./api/client";
import type { AgentMessage, ChatMessageResponse, ChatSummary, FileMetadata } from "./api/types";
import ChatList from "./components/ChatList";
import ChatWindow from "./components/ChatWindow";
import FileUpload from "./components/FileUpload";
import GeneratedContentList from "./components/GeneratedContentList";

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

  const activeMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const generatedFiles = useMemo(() => generatedContentQuery.data ?? [], [generatedContentQuery.data]);
  const uploadedDocs = useMemo(() => uploadedDocsQuery.data ?? [], [uploadedDocsQuery.data]);

  return (
    <div className="flex h-screen bg-slate-950">
      <ChatList
        chats={chatsQuery.data ?? []}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onCreateChat={handleCreateChat}
        isLoading={chatsQuery.isLoading}
        collapsed={!sidebarOpen}
      />
      <main className="flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-brand-500 hover:text-brand-400"
            >
              {sidebarOpen ? "Hide Chats" : "Show Chats"}
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Sudar AI — Personalized Tutor</h1>
              <p className="text-xs text-slate-500">Signed in as {USER_ID}</p>
            </div>
          </div>
          <div className="rounded-full border border-brand-500 bg-brand-500/10 px-3 py-1 text-xs uppercase tracking-wide text-brand-400">
            RAG Enabled
          </div>
        </header>
        <div className="grid h-[calc(100vh-88px)] grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <ChatWindow
            chatId={activeChatId}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            isLoadingHistory={messagesQuery.isLoading}
            isSending={sendMessageMutation.isPending}
            uploadedDocs={uploadedDocs}
            isUploading={uploadMutation.isPending}
          />
          <div className="flex flex-col gap-6">
            <FileUpload
              onUpload={handleUpload}
              disabled={uploadMutation.isPending || !activeChatId}
              documents={uploadedDocs}
              isLoadingDocuments={uploadedDocsQuery.isLoading}
            />
            <GeneratedContentList files={generatedFiles} isLoading={generatedContentQuery.isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
