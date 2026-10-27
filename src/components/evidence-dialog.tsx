"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { X } from "lucide-react";
import type { Evidence } from "@/lib/game/types";

type EvidenceDialogProps = { evidence: Evidence; onClose: () => void };

export function EvidenceDialog({ evidence, onClose }: EvidenceDialogProps) {
  const previousFocus = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.activeElement as HTMLElement | null,
  );

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="evidence-dialog-backdrop" />
        <Dialog.Content
          className="evidence-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previousFocus.current?.focus();
          }}
        >
          <div className="dialog-top">
            <div>
              <div className="eyebrow">Evidence {String(evidence.round).padStart(2, "0")} · {evidence.time}</div>
              <Dialog.Title className="dialog-title">{evidence.title}</Dialog.Title>
              <Dialog.Description className="sr-only">Public evidence detail and its known limitation.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" type="button" aria-label="Close evidence">
                <X size={19} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <img className="dialog-image" src={evidence.image} alt="" />
          <div className="dialog-body">
            <p>{evidence.detail}</p>
            <p className="limitation"><strong>What it cannot prove:</strong> {evidence.limitation}</p>
            <p className="dialog-question">{evidence.question}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
