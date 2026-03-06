'use client';
import { useEffect, useState } from 'react';

const API = process.env.API_URL || 'http://localhost:3000';

export default function AdminPage() {
  const [health, setHealth] = useState<any>(null);
  const [categories, setCategories] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(setHealth).catch(console.error);

    const cats = ['contact', 'organisation', 'product', 'action', 'location', 'event', 'review'];
    Promise.all(
      cats.map(c => fetch(`${API}/v1/entities?category=${c}&limit=1`).then(r => r.json()).then(d => [c, d.total]))
    ).then(results => {
      setCategories(Object.fromEntries(results));
    }).catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">WebDex Admin</h1>

      {health && (
        <div className="bg-webdex-card border border-webdex-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-webdex-green' : 'bg-webdex-red'}`} />
            <span className="text-white font-semibold">System {health.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-webdex-bg rounded-lg p-4">
              <div className="text-3xl font-extrabold text-webdex-green">{health.index?.entities?.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Total Entities</div>
            </div>
            <div className="bg-webdex-bg rounded-lg p-4">
              <div className="text-3xl font-extrabold text-webdex-purple">{health.index?.pages?.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Pages Indexed</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-webdex-card border border-webdex-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Entities by Category</h2>
        <div className="space-y-3">
          {Object.entries(categories).map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between">
              <span className="text-sm text-gray-400 capitalize">{cat}</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-webdex-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-webdex-green rounded-full"
                    style={{ width: `${Math.min((count / Math.max(...Object.values(categories), 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white w-16 text-right">{count.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
