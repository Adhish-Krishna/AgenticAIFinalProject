import { ChangeEvent, FC, useRef, useState } from "react";
import clsx from "clsx";
import LoadingSpinner from "./LoadingSpinner";
import type { FileMetadata } from "../api/types";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  documents?: FileMetadata[];
  isLoadingDocuments?: boolean;
}

const FileUpload: FC<FileUploadProps> = ({
  onUpload,
  disabled = false,
  documents = [],
  isLoadingDocuments = false,
}: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
  };

  const handleSubmit = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    try {
      setError(null);
      setIsUploading(true);
      await onUpload(file);
      setFilename("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-inner">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Upload a document</h3>
      <p className="mt-1 text-xs text-slate-500">
        Drop PDFs, DOCX, PPTX or plain text files. They will be added to your current chat and indexed for RAG.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md"
          onChange={handleChange}
          disabled={disabled || isUploading}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || isUploading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          Upload
        </button>
      </div>
      {filename && <p className="mt-2 text-xs text-slate-400">Selected: {filename}</p>}
      {isUploading && <LoadingSpinner className="mt-3" label="Uploading & indexing" />}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent documents</h4>
          {isLoadingDocuments && <LoadingSpinner className="text-[11px]" label="Refreshing" />}
        </div>
        {!isLoadingDocuments && documents.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">No uploads yet for this chat.</p>
        )}
        {!isLoadingDocuments && documents.length > 0 && (
          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            {documents.slice(0, 5).map((doc) => {
              const status = doc.status ?? "processing";
              const isIndexed = status === "indexed";
              const isError = status === "error";

              return (
                <li
                  key={doc.object_key}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium text-slate-200">{doc.file_name}</p>
                    <p className="text-[11px] text-slate-500">{doc.object_key}</p>
                  </div>
                  <span
                    className={clsx(
                      "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
                      {
                        "bg-emerald-500/10 text-emerald-300": isIndexed,
                        "bg-amber-500/10 text-amber-300": !isIndexed && !isError,
                        "bg-red-500/10 text-red-300": isError,
                      }
                    )}
                  >
                    {isIndexed ? "Indexed" : isError ? "Error" : "Processing"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
