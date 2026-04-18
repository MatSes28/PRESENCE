export const ExportGuide = () => (
  <div className="screen-only bg-gray-800 rounded-lg p-4 border border-gray-700">
    <h4 className="text-lg font-medium text-white mb-4">Export Guide</h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <div className="text-sm font-medium text-white mb-1">Raw CSV</div>
        <div className="text-sm text-gray-400">
          Plain data for imports, scripts, and database checks.
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-white mb-1">Styled Excel</div>
        <div className="text-sm text-gray-400">
          Formatted spreadsheet with borders, filters, and summary rows.
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-white mb-1">PDF</div>
        <div className="text-sm text-gray-400">
          Print-ready summary for sharing and filing.
        </div>
      </div>
    </div>
  </div>
);
