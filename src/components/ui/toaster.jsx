import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

function ToastItem({ id, title, description, action, duration = 5000, onRemove, ...props }) {
  const [visible, setVisible] = useState(true);

  const close = () => {
    setVisible(false);
    setTimeout(() => onRemove(id), 300);
  };

  useEffect(() => {
    const timer = setTimeout(close, duration);
    return () => clearTimeout(timer);
  }, [id, duration]);

  if (!visible) return null;

  return (
    <Toast {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose onClick={close} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, duration, open, ...props }) => (
        <ToastItem
          key={id}
          id={id}
          title={title}
          description={description}
          action={action}
          duration={duration}
          onRemove={dismiss}
          {...props}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}