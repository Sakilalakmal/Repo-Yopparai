import React from "react";
import { confirm } from "@tauri-apps/plugin-dialog";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps): React.JSX.Element | null {
  const launchedRef = React.useRef(false);

  React.useEffect(() => {
    if (!props.open) {
      launchedRef.current = false;
      return;
    }
    if (launchedRef.current) return;
    launchedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const options: { title: string; kind: "warning"; okLabel?: string; cancelLabel?: string } = {
          title: props.title,
          kind: "warning"
        };
        if (props.confirmLabel) options.okLabel = props.confirmLabel;
        if (props.cancelLabel) options.cancelLabel = props.cancelLabel;

        const confirmed = await confirm(props.message, {
          ...options
        });
        if (cancelled) return;
        if (confirmed) props.onConfirm();
        else props.onCancel();
      } catch {
        if (cancelled) return;
        props.onCancel();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    props.open,
    props.title,
    props.message,
    props.confirmLabel,
    props.cancelLabel,
    props.onConfirm,
    props.onCancel
  ]);

  return null;
}

