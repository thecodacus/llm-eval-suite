import { useEffect } from "react";
import { Icon } from "../icons";

export default function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="sm">{title}</h2>
          <button className="btn ghost" style={{ padding: "6px 10px" }} onClick={onClose} title="Close (Esc)"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
