"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { XIcon } from "lucide-react"

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border p-4 shadow-lg animate-in slide-in-from-right ${
            toast.variant === "destructive"
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h5 className="font-semibold text-sm mb-1">{toast.title}</h5>
              {toast.description && (
                <p className="text-sm opacity-90">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
