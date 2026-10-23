import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function ErrorState({ title, message, actions }: { title: string; message: string; actions?: ReactNode }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {actions && <div className="row gap">{actions}</div>}
      </div>
    </div>
  );
}
