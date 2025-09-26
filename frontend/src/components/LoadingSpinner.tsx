import { FC } from "react";
import clsx from "clsx";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

const LoadingSpinner: FC<LoadingSpinnerProps> = ({ label = "Loading", className }) => {
  return (
    <div className={clsx("flex items-center gap-3 text-slate-300", className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
    </div>
  );
};

export default LoadingSpinner;
