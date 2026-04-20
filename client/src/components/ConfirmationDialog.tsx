import React from "react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const titleId = `confirmation-dialog-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const descriptionId = `confirmation-dialog-description-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
      >
        <div className="p-6">
          <h3 id={titleId} className="mb-2 text-lg font-semibold text-white">
            {title}
          </h3>
          <p id={descriptionId} className="mb-6 text-gray-300">
            {message}
          </p>

          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 rounded-lg px-4 py-2 font-medium text-white transition-colors ${confirmButtonClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
