export interface ChatSummary {
  chat_id: string;
  chat_name?: string;
  message_count: number;
  first_message_time?: string;
  last_message_time?: string;
}

export interface AgentMessage {
  role: string;
  content: string;
  agent?: string;
  timestamp: string;
}

export interface ChatMessageResponse {
  messages: AgentMessage[];
}

export interface FileMetadata {
  object_key: string;
  file_name: string;
  last_modified?: string;
  size?: number;
  download_url: string;
  tags: Record<string, string>;
  status?: string;
}

export interface UploadResponse {
  object_key: string;
  message: string;
  status?: string;
}

export interface ChatMessageRequest {
  message: string;
  model_provider?: string;
  model_name?: string;
}

export interface ModelInfo {
  provider: string;
  name: string;
  display_name: string;
}

export interface AvailableModelsResponse {
  models: ModelInfo[];
}

export interface UpdateChatNameRequest {
  chat_name: string;
}

export interface UpdateChatNameResponse {
  success: boolean;
  message: string;
  chat_id: string;
  chat_name: string;
}

export interface DeleteChatResponse {
  success: boolean;
  message: string;
  deleted_files_count: number;
  deleted_messages_count: number;
  deleted_embeddings_count: number;
  deleted_checkpoints_count: number;
}
