import { FC } from "react";
import dayjs from "dayjs";
import type { FileMetadata } from "../api/types";
import LoadingSpinner from "./LoadingSpinner";

interface GeneratedContentListProps {
  files: FileMetadata[];
  isLoading?: boolean;
}

const GeneratedContentList: FC<GeneratedContentListProps> = ({ files, isLoading = false }: GeneratedContentListProps) => {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Generated PDFs</h3>
          <p className="text-xs text-slate-500">Agent-created content tagged as GeneratedContent</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] uppercase tracking-widest text-slate-400">
          {files.length} file{files.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <LoadingSpinner label="Fetching content" />
        ) : files.length === 0 ? (
          <p className="text-sm text-slate-500">No generated content yet. Ask the agent to create something!</p>
        ) : (
          files.map((file) => (
            <a
              key={file.object_key}
              href={file.download_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-4 rounded-xl border border-transparent bg-slate-800/70 px-4 py-3 text-sm text-slate-200 transition hover:border-brand-500 hover:bg-slate-800"
            >
              <div>
                <p className="font-semibold text-slate-100">{file.file_name}</p>
                <p className="text-xs text-slate-400">
                  {dayjs(file.last_modified).format("MMM D, YYYY HH:mm")} · {((file.size ?? 0) / 1024).toFixed(1)} KB
                </p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Download</span>
            </a>
          ))
        )}
      </div>
    </section>
  );
};

export default GeneratedContentList;
