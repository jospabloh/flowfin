import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

function ToastItem({ id, title, description, action, duration = 5000, dismiss, ...props }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration]);

  return (
    <Toast key={id} {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose onClick={() => dismiss(id)} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, duration, ...props }) => (
        <ToastItem
          key={id}
          id={id}
          title={title}
          description={description}
          action={action}
          duration={duration}
          dismiss={dismiss}
          {...props}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}