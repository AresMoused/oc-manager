import { LOGO_DATA_URL } from "@/lib/logo";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_DATA_URL}
            alt="AresMoused"
            width={28}
            height={28}
            className="rounded object-contain opacity-90"
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
