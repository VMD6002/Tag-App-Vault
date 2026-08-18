import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle2, OctagonAlert } from "lucide-react";

export type ConfirmVariant =
  | "default"
  | "destructive"
  | "warning"
  | "info"
  | "success";

export type ConfirmOptions = {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
};

type ConfirmState =
  | (ConfirmOptions & {
      resolve: (value: boolean) => void;
    })
  | null;

let confirmHandler: ((options: ConfirmOptions) => Promise<boolean>) | null =
  null;

function callConfirm(
  options: ConfirmOptions | string,
  defaultVariant: ConfirmVariant = "default",
): Promise<boolean> {
  if (!confirmHandler) {
    throw new Error("ConfirmProvider is missing from your app root.");
  }
  const opts = typeof options === "string" ? { description: options } : options;
  return confirmHandler({ variant: defaultVariant, ...opts });
}

/**
 * Global imperative confirm utility.
 * Usage:
 *   await confirm("Are you sure?")
 *   await confirm.destructive("Delete item?")
 *   await confirm.warning({ title: "Unsaved Changes", description: "You will lose progress." })
 */
export const confirm = Object.assign(
  (options: ConfirmOptions | string) => callConfirm(options, "default"),
  {
    destructive: (options: ConfirmOptions | string) =>
      callConfirm(options, "destructive"),
    warning: (options: ConfirmOptions | string) =>
      callConfirm(options, "warning"),
    info: (options: ConfirmOptions | string) => callConfirm(options, "info"),
    success: (options: ConfirmOptions | string) =>
      callConfirm(options, "success"),
  },
);

const variantConfig: Record<
  ConfirmVariant,
  { title: string; icon: React.ReactNode; buttonVariant: string }
> = {
  default: {
    title: "Are you sure?",
    icon: null,
    buttonVariant: "",
  },
  destructive: {
    title: "Delete item?",
    icon: <OctagonAlert className="h-5 w-5 text-destructive shrink-0" />,
    buttonVariant: buttonVariants({ variant: "destructive" }),
  },
  warning: {
    title: "Warning",
    icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    buttonVariant: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  info: {
    title: "Information",
    icon: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
    buttonVariant: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  success: {
    title: "Confirm Action",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    buttonVariant: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
};

export function ConfirmProvider() {
  const [state, setState] = useState<ConfirmState>(null);

  useEffect(() => {
    confirmHandler = (options) => {
      return new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      });
    };
    return () => {
      confirmHandler = null;
    };
  }, []);

  const handleClose = (result: boolean) => {
    if (state) {
      state.resolve(result);
      setState(null);
    }
  };

  if (!state) return null;

  const variant = state.variant || "default";
  const config = variantConfig[variant];

  return (
    <AlertDialog
      open={true}
      onOpenChange={(open) => !open && handleClose(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {config.icon}
            <AlertDialogTitle>{state.title || config.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {state.cancelText || "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={config.buttonVariant}
            onClick={() => handleClose(true)}
          >
            {state.confirmText || "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
