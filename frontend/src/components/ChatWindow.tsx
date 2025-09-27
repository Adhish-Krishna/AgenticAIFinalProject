import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
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
  isLoadingHistory?: boolean;
  isSending?: boolean;
  uploadedDocs?: FileMetadata[];
  isUploading?: boolean;
}

const ChatWindow = ({
  chatId,
  messages,
  onSendMessage,
  isLoadingHistory = false,
  isSending = false,
  uploadedDocs = [],
  isUploading = false,
}: ChatWindowProps) => {
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FileMetadata | null>(null);
  const [isMentionOpen, setIsMentionOpen] = useState<boolean>(false);
  const [mentionQuery, setMentionQuery] = useState<string>("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

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
      <div className="flex h-full flex-1 flex-col items-center justify-center text-center text-slate-500">
        <h2 className="text-lg font-semibold text-slate-300">Select a chat to get started</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Choose an existing conversation on the left or press <span className="text-brand-500">New</span> to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-900/60">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner label="Loading conversation" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-slate-500">
            No messages yet. Say hello to the agent to kick things off.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.timestamp}-${index}`} message={message} isOwn={message.role !== "assistant"} />
            ))}
            {isSending && <LoadingSpinner label="Agent is thinking" />}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-col gap-3">
          {selectedDocument && (
            <div className="flex items-center justify-between rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
              <span>
                Linked document: <strong>{selectedDocument.file_name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedDocument(null)}
                className="rounded-full border border-brand-500/40 px-2 py-1 text-[10px] uppercase tracking-wide text-brand-300 transition hover:border-brand-400 hover:text-brand-200"
              >
                Remove
              </button>
            </div>
          )}
          {isUploading && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
              Upload in progress… your document will be indexed in a moment.
            </div>
          )}
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handleKeyDown}
              className="h-28 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-200 shadow-inner transition focus:border-brand-500 focus:outline-none"
              placeholder={uploadedDocs.length ? "Type @ to reference a document..." : "Ask Sudar AI anything about your documents..."}
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending}
              className="h-12 rounded-xl bg-brand-600 px-6 text-sm font-semibold uppercase tracking-wide text-white shadow transition hover:bg-brand-500 disabled:cursor-wait disabled:bg-slate-700"
            >
              {isSending ? "Sending" : "Send"}
            </button>
            {isMentionOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-2 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-xl">
                <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-slate-500">
                  Reference a document ({mentionQuery ? `filter: ${mentionQuery}` : "all"})
                </p>
                <ul className="max-h-56 overflow-y-auto">
                  {filteredDocs.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-slate-500">No matching documents.</li>
                  ) : (
                    filteredDocs.map((doc) => {
                      const indexed = doc.status === "indexed";
                      return (
                        <li key={doc.object_key}>
                          <button
                            type="button"
                            onClick={() => indexed && handleSelectDocument(doc)}
                            className={clsx(
                              "flex w-full flex-col rounded-lg px-3 py-2 text-left transition",
                              indexed
                                ? "bg-slate-800/60 text-slate-100 hover:border-brand-500 hover:bg-slate-800"
                                : "cursor-not-allowed bg-slate-900/40 text-slate-500"
                            )}
                            disabled={!indexed}
                          >
                            <span className="text-sm font-semibold">{doc.file_name}</span>
                            <span className="text-[11px] uppercase tracking-wider text-slate-400">
                              {indexed ? "Indexed" : doc.status === "error" ? "Failed" : "Processing"}
                            </span>
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
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </form>
    </div>
  );
};

export default ChatWindow;
