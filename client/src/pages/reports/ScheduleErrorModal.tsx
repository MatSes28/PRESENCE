interface ScheduleErrorModalProps {
  error: {
    name: string;
    error: string;
  };
  onClose: () => void;
}

export const ScheduleErrorModal = ({
  error,
  onClose,
}: ScheduleErrorModalProps) => (
  <div
    className="screen-only fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="schedule-error-title"
    onClick={onClose}
  >
    <div
      className="w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between border-b border-gray-700 p-5">
        <div>
          <h4
            id="schedule-error-title"
            className="text-lg font-semibold text-white"
          >
            Schedule Failure Details
          </h4>
          <p className="mt-1 text-sm text-gray-400">{error.name}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded bg-gray-700 px-3 py-1 text-sm font-medium text-white hover:bg-gray-600"
        >
          Close
        </button>
      </div>
      <div className="p-5">
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-gray-950 p-4 text-sm text-red-100">
          {error.error}
        </pre>
      </div>
    </div>
  </div>
);
