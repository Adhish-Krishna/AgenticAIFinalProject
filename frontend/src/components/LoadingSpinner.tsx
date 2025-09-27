import { FC } from "react";
import clsx from "clsx";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

const LoadingSpinner: FC<LoadingSpinnerProps> = ({ label = "Loading", className }) => {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div className="flex gap-1">
        <div className="h-2 w-2 animate-bounce rounded-full bg-gemini-accent [animation-delay:-0.3s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-gemini-accent [animation-delay:-0.15s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-gemini-accent"></div>
      </div>
      <span className="text-sm text-gemini-textSoft">
        {label}
      </span>
    </div>
  );
};

export default LoadingSpinner;
