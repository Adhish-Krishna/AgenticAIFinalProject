import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from 'react-hot-toast';
import dayjs from "dayjs";

import api from "./api/client";
import type { AgentMessage, ChatMessageResponse, ChatMessageRequest, ChatSummary, FileMetadata, UpdateChatNameResponse, DeleteChatResponse } from "./api/types";
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
    refetchInterval: 5000, // Check for new files every 5 seconds
  });

  // Track previous generated files count to detect new files
  const [previousGeneratedCount, setPreviousGeneratedCount] = useState(0);
  // Track previous uploaded files to detect when indexing is complete
  const [previousUploadedFiles, setPreviousUploadedFiles] = useState<FileMetadata[]>([]);

  useEffect(() => {
    const currentCount = generatedContentQuery.data?.length || 0;
    if (currentCount > previousGeneratedCount) {
      const newFilesCount = currentCount - previousGeneratedCount;
      toast.success(
        `${newFilesCount} new content${newFilesCount > 1 ? 's are' : ' is'} generated!`,
        {
          icon: '📄',
          duration: 3000,
        }
      );
    }
    setPreviousGeneratedCount(currentCount);
  }, [generatedContentQuery.data, previousGeneratedCount]);


  
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

  // Track when files are indexed (appear in uploaded files list)
  useEffect(() => {
    const currentFiles = uploadedDocsQuery.data || [];

    // Find newly appeared files by comparing file names
    if (previousUploadedFiles.length > 0) {
      const previousFileMap = new Map(previousUploadedFiles.map(f => [f.file_name, f]));
      currentFiles.forEach(file => {
        const prev = previousFileMap.get(file.file_name);
        if (prev && prev.status === 'processing' && file.status === 'indexed') {
          toast.success(`${file.file_name} has been indexed and is ready for use!`, {
            icon: '📚',
            duration: 3000,
          });
        }
      });
      // Also keep the previous logic for new files appearing as indexed
      const previousFileNames = new Set(previousUploadedFiles.map(f => f.file_name));
      const newFiles = currentFiles.filter(f => !previousFileNames.has(f.file_name) && f.status === 'indexed');
      newFiles.forEach(file => {
        toast.success(`${file.file_name} has been indexed and is ready for use!`, {
          icon: '📚',
          duration: 3000,
        });
      });
    }

    setPreviousUploadedFiles(currentFiles);
  }, [uploadedDocsQuery.data]);

  useEffect(() => {
    if (!activeChatId && chatsQuery.data && chatsQuery.data.length > 0) {
      setActiveChatId(chatsQuery.data[0].chat_id);
    }
  }, [activeChatId, chatsQuery.data]);

  const sendMessageMutation = useMutation<ChatMessageResponse, Error, ChatMessageRequest, { previousMessages?: AgentMessage[] }>({
    mutationKey: ["send-message", activeChatId],
    mutationFn: async (payload: ChatMessageRequest) => {
      if (!activeChatId) throw new Error("Select a chat before sending messages");
      const response = await api.post<ChatMessageResponse>(`/api/chats/${activeChatId}/messages`, payload);
      return response.data;
    },
    onMutate: async (payload: ChatMessageRequest) => {
      if (!activeChatId) return { previousMessages: undefined };
      
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["messages", activeChatId] });
      
      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<AgentMessage[]>(["messages", activeChatId]);
      
      // Optimistically update to the new value
      const optimisticUserMessage: AgentMessage = {
        content: payload.message,
        role: "user",
        timestamp: dayjs().toISOString(),
      };
      
      queryClient.setQueryData<AgentMessage[]>(["messages", activeChatId], (old) => [
        ...(old || []),
        optimisticUserMessage,
      ]);
      
      // Return a context object with the snapshotted value
      return { previousMessages };
    },
    onError: (err, payload, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (activeChatId && context?.previousMessages) {
        queryClient.setQueryData(["messages", activeChatId], context.previousMessages);
      }
      
      toast.error(`Failed to send message. ${err instanceof Error ? err.message : 'Please try again.'}`, {
        duration: 4000,
      });
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
      
      toast.loading(`Uploading ${file.name}...`, { id: 'file-upload' });
      
      const payload = new FormData();
      payload.append("chat_id", activeChatId);
      payload.append("file", file);
      await api.post("/api/files/upload", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      return file;
    },
    onSuccess: async (file) => {
      toast.success(`${file.name} uploaded successfully!`, { id: 'file-upload' });
      
      if (!activeChatId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["generated-files", activeChatId] }),
        queryClient.invalidateQueries({ queryKey: ["uploaded-files", activeChatId] }),
      ]);
    },
    onError: (error, file) => {
      toast.error(`Failed to upload ${file.name}. ${error instanceof Error ? error.message : 'Please try again.'}`, { 
        id: 'file-upload',
        duration: 5000 
      });
    },
  });

  const updateChatNameMutation = useMutation({
    mutationFn: async ({ chatId, chatName }: { chatId: string; chatName: string }) => {
      const response = await api.put(`/api/chats/${chatId}/name`, { chat_name: chatName });
      return { ...response.data, chatName };
    },
    onSuccess: async (data) => {
      toast.success(`Chat renamed to "${data.chatName}"`, {
        icon: '✏️',
        duration: 2000,
      });
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (error) => {
      toast.error(`Failed to rename chat. ${error instanceof Error ? error.message : 'Please try again.'}`, {
        duration: 4000,
      });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      toast.loading('Deleting chat...', { id: `delete-${chatId}` });
      const response = await api.delete(`/api/chats/${chatId}`);
      return response.data;
    },
    onSuccess: async (_, chatId) => {
      toast.success('Chat deleted successfully!', { 
        id: `delete-${chatId}`,
        icon: '🗑️',
        duration: 2000,
      });
      
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      // If the deleted chat was active, switch to another chat or null
      if (activeChatId === chatId) {
        const remainingChats = (chatsQuery.data || []).filter(chat => chat.chat_id !== chatId);
        setActiveChatId(remainingChats.length > 0 ? remainingChats[0].chat_id : null);
      }
    },
    onError: (error, chatId) => {
      toast.error(`Failed to delete chat. ${error instanceof Error ? error.message : 'Please try again.'}`, { 
        id: `delete-${chatId}`,
        duration: 4000,
      });
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
      
      toast.success('New chat created!', {
        icon: '💬',
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to create chat", error);
      toast.error('Failed to create new chat. Please try again.', {
        duration: 4000,
      });
    }
  };

  const handleSendMessage = async (message: string, model_provider?: string, model_name?: string): Promise<void> => {
    if (!activeChatId) {
      // Create a new chat first
      const response = await api.get<{ next_chat_id: string }>("/api/chats/next-id");
      const newChatId = response.data.next_chat_id ?? String(INITIAL_CHAT_ID + 1);
      setActiveChatId(newChatId);
      
      // Add optimistic chat to the list
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
      
      // Add optimistic user message
      const optimisticUserMessage: AgentMessage = {
        content: message,
        role: "user",
        timestamp: dayjs().toISOString(),
      };
      
      queryClient.setQueryData<AgentMessage[]>(["messages", newChatId], [optimisticUserMessage]);
      
      // Send message to the new chat
      try {
        const requestPayload: any = { message };
        if (model_provider) requestPayload.model_provider = model_provider;
        if (model_name) requestPayload.model_name = model_name;
        
        await api.post<ChatMessageResponse>(`/api/chats/${newChatId}/messages`, requestPayload);
        
        // Refresh the messages to get the full conversation including agent response
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["messages", newChatId] }),
          queryClient.invalidateQueries({ queryKey: ["chats"] }),
        ]);
      } catch (error) {
        // On error, remove the optimistic updates
        queryClient.setQueryData<AgentMessage[]>(["messages", newChatId], []);
        throw error;
      }
      
      return;
    }
    
    const payload: ChatMessageRequest = { message };
    if (model_provider) payload.model_provider = model_provider;
    if (model_name) payload.model_name = model_name;
    
    await sendMessageMutation.mutateAsync(payload);
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
    // Show confirmation toast
    toast((t) => (
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-medium text-gemini-text">Delete Chat?</p>
          <p className="text-sm text-gemini-textSoft mt-1">
            This will permanently delete all messages, uploaded files, and generated content.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            onClick={() => {
              toast.dismiss(t.id);
              deleteChatMutation.mutate(chatId);
            }}
          >
            Delete
          </button>
          <button
            className="bg-gemini-border hover:bg-gemini-surface text-gemini-text px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      style: {
        background: '#1f1f1f', // gemini-surface
        color: '#e8eaed', // gemini-text
        border: '1px solid #2d2d30', // gemini-border
        borderRadius: '12px',
        maxWidth: '400px',
        padding: '16px',
      },
    });
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
              <h1 className="text-xl font-medium text-gemini-text">Teach Assist</h1>
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
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f1f1f', // gemini-surface
            color: '#e8eaed', // gemini-text
            border: '1px solid #2d2d30', // gemini-border
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: {
            duration: 3000,
            style: {
              background: '#1f1f1f',
              color: '#e8eaed',
              border: '1px solid #4ade80', // green accent
            },
            iconTheme: {
              primary: '#4ade80', // success green
              secondary: '#1f1f1f',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#1f1f1f',
              color: '#e8eaed',
              border: '1px solid #ef4444', // error red
            },
            iconTheme: {
              primary: '#ef4444', // error red
              secondary: '#1f1f1f',
            },
          },
          loading: {
            style: {
              background: '#1f1f1f',
              color: '#e8eaed',
              border: '1px solid #8ab4f8', // gemini-accent
            },
            iconTheme: {
              primary: '#8ab4f8', // gemini-accent
              secondary: '#1f1f1f',
            },
          },
        }}
      />
    </div>
  );
};

export default App;
