'use client';
import { useState } from 'react';

const API = process.env.API_URL || 'http://localhost:3000';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-white mb-2">Search. Learn. Act.</h1>
        <p className="text-gray-500">The semantic action index for the AI web</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="solar installers perth, migration agents WA, IT courses CRICOS..."
          className="flex-1 bg-webdex-card border border-webdex-border rounded-xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-webdex-green"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-4 bg-webdex-green text-webdex-bg font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results && (
        <div>
          <div className="flex gap-2 mb-4 text-sm">
            <span className="px-3 py-1 bg-webdex-green/10 text-webdex-green rounded-md font-semibold">
              {results.total} results
            </span>
            <span className="px-3 py-1 bg-webdex-card text-gray-500 rounded-md">
              {results.latency_ms}ms
            </span>
          </div>

          <div className="space-y-3">
            {results.results?.map((entity: any) => (
              <a
                key={entity.id}
                href={`/entity/${entity.id}`}
                className="block bg-webdex-card border border-webdex-border rounded-xl p-5 hover:border-webdex-green/40 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-webdex-purple/15 text-webdex-purple mr-2">
                      {entity.category}
                    </span>
                    <span className="text-xs text-gray-600">{entity.domain}</span>
                  </div>
                  {entity.vector_similarity && (
                    <span className="text-xs text-webdex-cyan">
                      {(entity.vector_similarity * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                <h3 className="text-white font-semibold text-lg">
                  {entity.data?.name || entity.data?.purpose || 'Unnamed entity'}
                </h3>
                <div className="text-sm text-gray-500 mt-1">
                  {entity.data?.role && <span>{entity.data.role} · </span>}
                  {entity.data?.email && <span>{entity.data.email} · </span>}
                  {entity.data?.price && <span>${entity.data.price.amount} {entity.data.price.currency} · </span>}
                  {entity.data?.type && <span>{entity.data.type}</span>}
                </div>
                <div className="flex gap-2 mt-3 text-xs">
                  <span className="text-gray-600">Confidence: {(entity.confidence * 100).toFixed(0)}%</span>
                  {entity.aieo_score > 0 && <span className="text-webdex-amber">AIEO: {entity.aieo_score}</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
