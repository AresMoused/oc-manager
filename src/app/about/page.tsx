import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 space-y-6 text-sm text-neutral-300">
        <h1 className="text-2xl font-semibold text-white">关于</h1>
        <p>
          OC Manager 由 <span className="text-purple-300">AresMoused</span> 制作，用来管 TRPG / 原创角色卡、世界和外观提示词。
        </p>
        <section className="border border-neutral-800 rounded-2xl p-4 bg-[#111] space-y-2">
          <h2 className="text-white font-medium">致谢</h2>
          <p>
            站内「陪玩姬」助手对话框的交互与设定习惯，参考了 SillyTavern 扩展{" "}
            <a
              className="text-fuchsia-300 hover:underline"
              href="https://github.com/damoshen123/st-chatu8"
              target="_blank"
              rel="noopener noreferrer"
            >
              st-chatu8
            </a>
            。
          </p>
          <p>
            感谢原版智绘姬的作者 <span className="text-fuchsia-200 font-medium">从前和你一样</span>。
          </p>
        </section>
        <p>
          <Link href="/" className="text-purple-400 hover:underline">
            返回世界列表
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}