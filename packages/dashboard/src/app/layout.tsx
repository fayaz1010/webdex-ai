import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'WebDex AI', description: 'The Semantic Action Index for the AI Web' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-webdex-border px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-webdex-green to-webdex-cyan flex items-center justify-center">
            <span className="text-sm font-extrabold text-webdex-bg">W</span>
          </div>
          <span className="text-lg font-bold text-white">WebDex</span>
          <div className="flex gap-4 ml-8 text-sm">
            <a href="/" className="text-gray-400 hover:text-white">Search</a>
            <a href="/console" className="text-gray-400 hover:text-white">Console</a>
            <a href="/admin" className="text-gray-400 hover:text-white">Admin</a>
            <a href="/admin/super" className="text-gray-400 hover:text-white">Pipeline</a>
            <a href="/admin/ops-agent" className="text-gray-400 hover:text-white">OpsAgent</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
