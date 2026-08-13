export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="AresMoused"
            width={28}
            height={28}
            className="rounded object-contain opacity-90 bg-purple-700/40"
            onError={(e) => {
              const t = e.currentTarget;
              t.onerror = null;
              t.src =
                "data:image/svg+xml," +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7c3aed"/><text x="32" y="38" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="700">Ares</text></svg>'
                );
            }}
          />
          <div>
            <p className="text-neutral-400">
              Created by{" "}
              <span className="text-purple-400 font-medium">AresMoused</span>
            </p>
            <p className="text-neutral-600">
              © {new Date().getFullYear()} AresMoused. All rights reserved.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a
            href="mailto:ares@aresmoused.com"
            className="hover:text-purple-400 transition"
          >
            ares@aresmoused.com
          </a>
          <a
            href="https://discord.gg/Adu5nCDKxH"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-400 transition"
          >
            Discord
          </a>
          <a
            href="https://civitai.red/user/AresMoused"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-400 transition"
          >
            Civitai
          </a>
        </div>
      </div>
    </footer>
  );
}
