import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import type { AgentMessage, FileMetadata } from "../api/types";
import MessageBubble from "./MessageBubble";
import LoadingSpinner from "./LoadingSpinner";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const removeDocumentMention = (message: string, fileName: string) => {
  const escapedName = escapeRegExp(fileName);
  const mentionRegex = new RegExp(`(^|\\s)@${escapedName}(?=\\b)`, "gi");
  const withoutMention = message.replace(mentionRegex, (match, leading) => leading ?? "");
  return withoutMention.replace(/\s{2,}/g, " ").trim();
};

interface ChatWindowProps {
  chatId: string | null;
  messages: AgentMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onUpload?: (file: File) => Promise<void>;
  isLoadingHistory?: boolean;
  isSending?: boolean;
  uploadedDocs?: FileMetadata[];
  isUploading?: boolean;
  generatedFiles?: FileMetadata[];
  userName?: string;
}

const ChatWindow = ({
  chatId,
  messages,
  onSendMessage,
  onUpload,
  isLoadingHistory = false,
  isSending = false,
  uploadedDocs = [],
  isUploading = false,
  generatedFiles = [],
  userName = "User",
}: ChatWindowProps) => {
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FileMetadata | null>(null);
  const [isMentionOpen, setIsMentionOpen] = useState<boolean>(false);
  const [mentionQuery, setMentionQuery] = useState<string>("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showFilesPanel, setShowFilesPanel] = useState<boolean>(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  const closeMentionPalette = () => {
    setIsMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
  };

  useEffect(() => {
    setDraft("");
    setSelectedDocument(null);
    closeMentionPalette();
  }, [chatId]);

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = event.target;
    setDraft(value);

    const cursorPosition = selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex >= 0) {
      const charBefore = textBeforeCursor[atIndex - 1];
      const query = textBeforeCursor.slice(atIndex + 1);
      const isValidTrigger = atIndex === 0 || !charBefore || /\s/.test(charBefore);
      const hasSpace = query.includes(" ");

      if (isValidTrigger && !hasSpace && query.length <= 48) {
        setMentionQuery(query);
        setMentionStart(atIndex);
        setIsMentionOpen(true);
        return;
      }
    }

    closeMentionPalette();
  };

  const handleSelectDocument = (doc: FileMetadata) => {
    setSelectedDocument(doc);

    if (textareaRef.current && mentionStart !== null) {
      const cursorPosition = textareaRef.current.selectionStart ?? draft.length;
      const before = draft.slice(0, mentionStart);
      const after = draft.slice(cursorPosition);
      const insertion = `@${doc.file_name} `;
      const nextDraft = `${before}${insertion}${after}`;

      setDraft(nextDraft);

      requestAnimationFrame(() => {
        const nextCursor = before.length + insertion.length;
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        textareaRef.current?.focus();
      });
    }

    closeMentionPalette();
  };

  const sendCurrentMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Type something to send");
      return;
    }

    const messageWithContext = selectedDocument
      ? `this is the object id ${selectedDocument.object_key} ${removeDocumentMention(trimmed, selectedDocument.file_name)}`.trim()
      : trimmed;

    try {
      setError(null);
      await onSendMessage(messageWithContext);
      setDraft("");
      setSelectedDocument(null);
      closeMentionPalette();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendCurrentMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && isMentionOpen) {
      event.preventDefault();
      closeMentionPalette();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isMentionOpen) {
        return;
      }

      if (!isSending) {
        void sendCurrentMessage();
      }
    }
  };

  const filteredDocs = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) {
      return uploadedDocs;
    }

    return uploadedDocs.filter((doc) =>
      doc.file_name.toLowerCase().includes(query) || doc.object_key.toLowerCase().includes(query)
    );
  }, [mentionQuery, uploadedDocs]);

  if (!chatId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="flex h-full max-w-3xl flex-col items-center justify-center text-center">
          <div className="mb-12">
            <h1 className="mb-4 text-5xl font-medium text-gemini-text">Hello, {userName}</h1>
            <p className="text-xl text-gemini-textSoft">How can I help you today?</p>
          </div>
          <div className="w-full">
            <div className="relative mx-auto max-w-2xl">
              <form onSubmit={handleSubmit}>
                <div className="rounded-full border border-gemini-border bg-gemini-surface p-2">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={handleKeyDown}
                    className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent text-lg leading-7 text-gemini-text placeholder-gemini-textSoft focus:outline-none"
                    placeholder="Message SUDAR (use @ to add context)"
                    disabled={isSending}
                    rows={1}
                    style={{ height: '28px', lineHeight: '28px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = '28px';
                      target.style.height = `${Math.max(28, target.scrollHeight)}px`;
                    }}
                  />
                  <div className="flex items-center gap-2">
                    {uploadedDocs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsMentionOpen(!isMentionOpen)}
                        className="rounded-full p-2 text-gemini-textSoft transition hover:bg-gemini-border hover:text-gemini-text"
                        title="Reference document"
                      >
                        📎
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full p-2 text-gemini-textSoft transition hover:bg-gemini-border hover:text-gemini-text"
                      title="Upload file"
                    >
                      📁
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt,.md"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && onUpload) {
                          await onUpload(file);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !draft.trim()}
                      className="rounded-full bg-gemini-accent p-3 text-white transition hover:bg-gemini-accent/80 disabled:cursor-not-allowed disabled:bg-gemini-border disabled:text-gemini-textSoft"
                    >
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    </button>
                  </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Files Panel */}
      {showFilesPanel && (
        <div className="fixed right-0 top-0 z-50 h-full w-96 border-l border-gemini-border bg-gemini-bg shadow-2xl">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-gemini-border p-4">
              <h2 className="text-lg font-medium text-gemini-text">Files</h2>
              <button
                onClick={() => setShowFilesPanel(false)}
                className="rounded-lg p-2 text-gemini-textSoft hover:bg-gemini-surface hover:text-gemini-text"
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {/* Created Section */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-gemini-text">Created</h3>
                {generatedFiles && generatedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {generatedFiles.map((file) => (
                      <a
                        key={file.object_key}
                        href={file.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 rounded-lg border border-gemini-border bg-gemini-surface/30 p-3 transition hover:bg-gemini-surface"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500/10">
                          <svg className="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-gemini-text">{file.file_name}</div>
                          <div className="text-xs text-gemini-textSoft">
                            {((file.size ?? 0) / 1024).toFixed(1)} KB • {dayjs(file.last_modified).format("MMM D")}
                          </div>
                        </div>
                        <svg className="h-4 w-4 text-gemini-textSoft opacity-0 transition group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gemini-textSoft py-8">
                    You haven't created anything yet
                  </div>
                )}
              </div>

              {/* Added Section */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-gemini-text">Added</h3>
                {uploadedDocs && uploadedDocs.length > 0 ? (
                  <div className="space-y-2">
                    {uploadedDocs.map((doc) => {
                      const indexed = doc.status === "indexed";
                      const processing = doc.status === "processing";
                      const failed = doc.status === "error";
                      
                      return (
                        <div
                          key={doc.object_key}
                          className="flex items-center gap-3 rounded-lg border border-gemini-border bg-gemini-surface/30 p-3"
                        >
                          <div className={clsx(
                            "flex h-8 w-8 items-center justify-center rounded",
                            indexed ? "bg-green-500/10" : processing ? "bg-yellow-500/10" : "bg-red-500/10"
                          )}>
                            {processing ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-yellow-400 border-t-transparent"></div>
                            ) : (
                              <svg className={clsx(
                                "h-4 w-4",
                                indexed ? "text-green-400" : failed ? "text-red-400" : "text-gemini-textSoft"
                              )} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-gemini-text">{doc.file_name}</div>
                            <div className="text-xs text-gemini-textSoft">
                              {indexed ? "Ready" : processing ? "Processing..." : "Failed"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gemini-textSoft py-8">
                    No files uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header with Files Button */}
      {chatId && (
        <div className="flex items-center flex-row justify-end px-4 py-3">
          <button
            onClick={() => setShowFilesPanel(!showFilesPanel)}
            className="rounded-lg border border-gemini-border bg-gemini-surface/30 p-2.5 text-gemini-text hover:bg-gemini-surface hover:text-white transition-all"
            title="View files"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {isLoadingHistory ? (
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner label="Loading conversation" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <h1 className="mb-4 text-4xl font-medium text-gemini-text">Hello, {userName}</h1>
              <p className="mb-8 text-xl text-gemini-textSoft">How can I help you today?</p>
            </div>
          ) : (
            <div className="space-y-6 pb-32">
              {messages.map((message, index) => (
                <MessageBubble key={`${message.timestamp}-${index}`} message={message} isOwn={message.role !== "assistant"} />
              ))}
              {isSending && (
                <div className="flex items-center gap-3 text-gemini-textSoft">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gemini-surface">
                    <div className="h-1 w-1 animate-pulse rounded-full bg-gemini-accent"></div>
                  </div>
                  <LoadingSpinner label="Sudar AI is thinking..." />
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>
      <div className="flex bottom-0 left-0 right-0 bg-gemini-bg px-4 py-6">
        <div className="mx-auto w-full max-w-6xl px-2">
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              {selectedDocument && (
                <div className="flex items-center gap-2 text-sm text-gemini-textSoft">
                  <span className="rounded bg-gemini-accent/20 px-2 py-1 text-xs text-gemini-accent">
                    📄 {selectedDocument.file_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDocument(null)}
                    className="text-gemini-textSoft hover:text-gemini-text"
                  >
                    ✕
                  </button>
                </div>
              )}
              {isUploading && (
                <div className="flex items-center gap-3 rounded-xl border border-gemini-border bg-gemini-surface/30 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gemini-accent/10">
                    <svg className="h-4 w-4 animate-spin text-gemini-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gemini-text">Uploading document...</div>
                    <div className="text-xs text-gemini-textSoft">Processing and indexing for RAG</div>
                  </div>
                </div>
              )}
              <div className="relative w-full">
                <div className="w-full rounded-full border border-gemini-border bg-gemini-surface   p-2">
                  <div className="flex w-full items-center gap-3 px-5 py-4">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={handleDraftChange}
                      onKeyDown={handleKeyDown}
                      className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent text-lg leading-7 text-gemini-text placeholder-gemini-textSoft focus:outline-none"
                      placeholder="Message SUDAR (use @ to add context)"
                      disabled={isSending}
                      rows={1}
                      style={{ height: '28px', lineHeight: '28px' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = '28px';
                        target.style.height = `${Math.max(28, target.scrollHeight)}px`;
                      }}
                    />
                    <div className="flex items-center gap-2">
                      {uploadedDocs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsMentionOpen(!isMentionOpen)}
                          className="rounded-full p-2 text-gemini-textSoft transition hover:bg-gemini-border hover:text-gemini-text"
                          title="Reference document"
                        >
                          📎
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-full p-2 text-gemini-textSoft transition hover:bg-gemini-border hover:text-gemini-text"
                        title="Upload file"
                      >
                        📁
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.pptx,.txt,.md"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && onUpload) {
                            await onUpload(file);
                          }
                        }}
                      />
                      <button
                        type="submit"
                        disabled={isSending || !draft.trim()}
                        className="rounded-full bg-gemini-accent p-3 text-white transition hover:bg-gemini-accent/80 disabled:cursor-not-allowed disabled:bg-gemini-border disabled:text-gemini-textSoft"
                      >
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                {isMentionOpen && (
                  <div className="absolute bottom-full left-0 z-10 mb-3 w-full max-w-md rounded-2xl border border-gemini-border bg-gemini-surface/95 p-4 shadow-2xl backdrop-blur-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <svg className="h-4 w-4 text-gemini-accent" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                      <h4 className="text-sm font-medium text-gemini-text">Reference a document</h4>
                    </div>
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {filteredDocs.length === 0 ? (
                        <li className="flex items-center gap-3 px-3 py-3 text-sm text-gemini-textSoft">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          No documents available
                        </li>
                      ) : (
                        filteredDocs.map((doc) => {
                          const indexed = doc.status === "indexed";
                          return (
                            <li key={doc.object_key}>
                              <button
                                type="button"
                                onClick={() => indexed && handleSelectDocument(doc)}
                                className={clsx(
                                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition",
                                  indexed
                                    ? "hover:bg-gemini-border text-gemini-text"
                                    : "cursor-not-allowed text-gemini-textSoft"
                                )}
                                disabled={!indexed}
                              >
                                <div className={clsx(
                                  "flex h-8 w-8 items-center justify-center rounded-lg",
                                  indexed ? "bg-gemini-accent/10" : "bg-gemini-border"
                                )}>
                                  <svg className={clsx("h-4 w-4", indexed ? "text-gemini-accent" : "text-gemini-textSoft")} fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate font-medium">{doc.file_name}</div>
                                  <div className="text-xs text-gemini-textSoft">
                                    {indexed ? "Ready to reference" : doc.status === "error" ? "Upload failed" : "Processing..."}
                                  </div>
                                </div>
                                {indexed && (
                                  <svg className="h-4 w-4 text-gemini-textSoft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
