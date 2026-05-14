function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {/* Role label */}
      <div className="text-xs font-semibold text-(--vscode-descriptionForeground)">ForgeAI</div>

      {/* Skeleton content box */}
      <div className="rounded border p-3 border-(--vscode-input-border) bg-(--vscode-sideBar-background)">
        {/* Animated skeleton lines with shimmer */}
        <div className="flex flex-col gap-2">
          <div
            className="h-3 bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600 animate-[shimmer_1.5s_infinite] rounded"
            style={{ width: '60%' }}
          />
          <div
            className="h-3 bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600 animate-[shimmer_1.5s_infinite] rounded"
            style={{ width: '90%', animationDelay: '0.1s' }}
          />
          <div
            className="h-3 bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600 animate-[shimmer_1.5s_infinite] rounded"
            style={{ width: '85%', animationDelay: '0.2s' }}
          />
          <div
            className="h-3 bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600 animate-[shimmer_1.5s_infinite] rounded"
            style={{ width: '70%', animationDelay: '0.3s' }}
          />
          <div
            className="h-3 bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600 animate-[shimmer_1.5s_infinite] rounded"
            style={{ width: '50%', animationDelay: '0.4s' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

export default SkeletonLoader;
