export default function MitreTags({ techniques = [] }) {
  if (!techniques.length) {
    return <div className="font-mono text-xs uppercase text-slate-500">No mapped ATT&CK techniques</div>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {techniques.map((technique) => (
        <a
          key={technique.id}
          href={technique.url}
          target="_blank"
          rel="noreferrer"
          title={`${technique.id} ${technique.name}`}
          className="border border-cyan/40 bg-cyan/10 px-3 py-2 font-mono text-xs uppercase text-cyan shadow-cyan transition hover:bg-cyan hover:text-black"
        >
          {technique.id} | {technique.name}
        </a>
      ))}
    </div>
  );
}
