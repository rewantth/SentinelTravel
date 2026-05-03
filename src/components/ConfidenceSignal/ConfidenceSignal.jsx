export default function ConfidenceSignal({ confidence = 0 }) {
  const activeBars = Math.ceil(confidence * 5);
  return (
    <div className="flex items-end gap-1.5">
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`w-4 border border-cyan/50 transition-all duration-500 ${
            bar <= activeBars ? "bg-cyan shadow-cyan" : "bg-line/50"
          }`}
          style={{ height: 12 + bar * 7 }}
        />
      ))}
      <span className="ml-3 font-mono text-xs text-cyan">{Math.round(confidence * 100)}%</span>
    </div>
  );
}

