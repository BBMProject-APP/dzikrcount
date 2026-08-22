/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smartphone, Code, BookOpen, Sparkles, Star } from "lucide-react";
import AndroidSimulator from "./components/AndroidSimulator";
import CodeExplorer from "./components/CodeExplorer";
import SetupGuide from "./components/SetupGuide";

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulator" | "code" | "guide">("simulator");

  return (
    <div id="workspace-root" className="min-h-screen bg-[#022c22] text-[#ecfdf5] flex flex-col selection:bg-emerald-800/60 relative overflow-hidden font-sans">
      
      {/* FROSTED GLASS BACKGROUND GLOW BLOBS */}
      <div className="absolute inset-0 opacity-30 pointer-events-none z-0">
        <div className="absolute top-[-150px] left-[-150px] w-[600px] h-[600px] bg-emerald-500 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-150px] right-[-150px] w-[700px] h-[700px] bg-teal-600 rounded-full blur-[160px]"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-emerald-400 rounded-full blur-[120px] opacity-40"></div>
      </div>

      {/* HEADER SECTION - FROSTED GLASS */}
      <header className="border-b border-emerald-800/40 bg-emerald-950/40 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] shrink-0">
            <Sparkles size={20} className="text-emerald-950 font-black animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-extrabold text-white text-lg md:text-xl tracking-tight">Dzikr & Salawat Count</h1>
              <span className="text-[10px] bg-emerald-900/60 border border-emerald-700/40 text-emerald-300 font-bold px-2 py-0.5 rounded-full font-mono">v1.0 (Media3)</span>
            </div>
            <p className="text-xs text-emerald-200/70 mt-0.5">Automated audio-looping counter & clean architecture resource center.</p>
          </div>
        </div>

        {/* CONTROLS & DEV INFO */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-mono block font-bold">Android Architecture</span>
            <span className="text-xs text-emerald-300 font-semibold">Clean Domain + Jetpack Media3</span>
          </div>
          <div className="h-8 w-px bg-emerald-800/40 hidden sm:block"></div>
          <div className="flex items-center space-x-2 bg-emerald-900/40 px-3 py-1.5 rounded-full border border-emerald-700/30">
            <Star size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-200">Islamic Utilities</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6 relative z-10">
        
        {/* TAB SWITCHER - FROSTED GLASS */}
        <div className="flex items-center gap-1 bg-emerald-950/40 backdrop-blur-lg border border-emerald-800/40 p-1.5 rounded-2xl w-full max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "simulator"
                ? "bg-emerald-500 text-emerald-950 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "text-emerald-200/60 hover:text-white"
            }`}
          >
            <Smartphone size={15} />
            <span>App Simulator</span>
          </button>
          
          <button
            onClick={() => setActiveTab("code")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "code"
                ? "bg-emerald-500 text-emerald-950 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "text-emerald-200/60 hover:text-white"
            }`}
          >
            <Code size={15} />
            <span>Kotlin Source Code</span>
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "guide"
                ? "bg-emerald-500 text-emerald-950 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "text-emerald-200/60 hover:text-white"
            }`}
          >
            <BookOpen size={15} />
            <span>Gradle & Manifest Setup</span>
          </button>
        </div>

        {/* TAB WORKSPACE */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            {activeTab === "simulator" && (
              <motion.div
                key="simulator"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <AndroidSimulator />
              </motion.div>
            )}

            {activeTab === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <CodeExplorer />
              </motion.div>
            )}

            {activeTab === "guide" && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <SetupGuide />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900/80 bg-slate-950/80 mt-auto py-6 text-center text-slate-500 text-[11px] font-sans">
        <p className="tracking-wide">Dzikr & Salawat Count Workspace • Production-grade templates and interactive play simulator</p>
        <p className="mt-1.5 text-emerald-600/80">Respectful, Ethical, and Accessible Islamic Utility Architecture</p>
      </footer>

    </div>
  );
}
