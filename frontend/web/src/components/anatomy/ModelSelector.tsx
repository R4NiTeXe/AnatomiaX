import { anatomyAssetList } from './anatomyAssets';
import type { AnatomyModelKey } from './anatomyAssets';

type ModelSelectorProps = {
  selected: AnatomyModelKey | null;
  onSelect: (key: AnatomyModelKey) => void;
};

export default function ModelSelector({ selected, onSelect }: ModelSelectorProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {anatomyAssetList.map(asset => (
        <button
          key={asset.key}
          type="button"
          disabled={!asset.available}
          onClick={() => asset.available && onSelect(asset.key as AnatomyModelKey)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            selected === asset.key
              ? 'border-teal-500 bg-teal-500/10 text-teal-300'
              : asset.available
                ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-500'
          }`}
          aria-disabled={!asset.available}
          title={!asset.available ? 'Coming soon — model not yet available' : asset.label}
        >
          <span>{asset.label}</span>
          {!asset.available && (
            <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs tracking-widest text-slate-400">
              COMING SOON
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
