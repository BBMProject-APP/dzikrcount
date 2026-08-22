import { useState } from "react";
import { Folder, FileCode, Copy, Check, Info } from "lucide-react";
import { KOTLIN_TEMPLATES, CodeFile } from "../data/kotlinCodeTemplates";

export default function CodeExplorer() {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(KOTLIN_TEMPLATES[0]);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  // Directory Tree representation
  const fileTree = [
    {
      name: "app",
      type: "folder",
      children: [
        {
          name: "src/main/java/com/islamic/dzikrsalawat",
          type: "folder",
          children: [
            {
              name: "domain",
              type: "folder",
              children: [
                { name: "model/DhikrItem.kt", type: "file", template: "DhikrItem.kt" },
                { name: "usecase/PlayDhikrUseCase.kt", type: "file", template: "PlayDhikrUseCase.kt" }
              ]
            },
            {
              name: "presentation",
              type: "folder",
              children: [
                { name: "service/DhikrPlaybackService.kt", type: "file", template: "DhikrPlaybackService.kt" },
                { name: "viewmodel/DhikrViewModel.kt", type: "file", template: "DhikrViewModel.kt" },
                { name: "ui/DhikrPlayerScreen.kt", type: "file", template: "DhikrPlayerScreen.kt" }
              ]
            }
          ]
        },
        {
          name: "AndroidManifest.xml",
          type: "file",
          template: "AndroidManifest.xml"
        },
        {
          name: "build.gradle.kts",
          type: "file",
          template: "build.gradle.kts"
        }
      ]
    }
  ];

  const renderTree = (nodes: any[], depth = 0) => {
    return nodes.map((node, idx) => {
      if (node.type === "folder") {
        return (
          <div key={`${node.name}-${depth}-${idx}`} className="select-none">
            <div 
              className="flex items-center gap-2 py-1 px-2 text-emerald-100 hover:bg-emerald-900/40 rounded cursor-pointer text-sm font-medium transition"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <Folder size={16} className="text-emerald-400 shrink-0" />
              <span>{node.name}</span>
            </div>
            {node.children && <div>{renderTree(node.children, depth + 1)}</div>}
          </div>
        );
      } else {
        const correspondingTemplate = KOTLIN_TEMPLATES.find(t => t.name === node.template);
        const isSelected = selectedFile.name === node.template;
        return (
          <div
            key={`${node.name}-${depth}-${idx}`}
            onClick={() => correspondingTemplate && setSelectedFile(correspondingTemplate)}
            className={`flex items-center gap-2 py-1 px-3 cursor-pointer text-sm rounded transition select-none ${
              isSelected 
                ? "bg-emerald-900/60 text-emerald-300 font-medium border-l-2 border-emerald-400" 
                : "text-emerald-200/80 hover:bg-emerald-900/30"
            }`}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <FileCode size={14} className={isSelected ? "text-emerald-400 shrink-0" : "text-emerald-500 shrink-0"} />
            <span className="truncate">{node.name.split("/").pop()}</span>
          </div>
        );
      }
    });
  };

  return (
    <div id="code-explorer-hub" className="bg-emerald-950/30 backdrop-blur-xl rounded-2xl border border-emerald-700/30 p-4 md:p-6 shadow-2xl flex flex-col lg:flex-row gap-6 min-h-[580px]">
      {/* File Tree Left Section */}
      <div className="lg:w-1/3 flex flex-col gap-3">
        <div className="border-b border-emerald-800/40 pb-3">
          <h3 className="font-sans font-bold text-white text-base">Clean Architecture Tree</h3>
          <p className="text-xs text-emerald-200/70 mt-1">Recommended package blueprint structure for your Android Studio module.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto max-h-[380px] lg:max-h-[500px] pr-2 scrollbar-thin scrollbar-thumb-emerald-800 bg-emerald-950/60 p-3 rounded-xl border border-emerald-800/40">
          {renderTree(fileTree)}
        </div>

        <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 flex gap-2.5 items-start">
          <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-100 leading-relaxed">
            <span className="text-emerald-400 font-medium">Jetpack Media3 Notice:</span> This clean design integrates ExoPlayer and Foreground Service bindings directly in <span className="font-mono text-[10px] text-emerald-300">DhikrPlaybackService.kt</span> to achieve gapless looping and robust background survival.
          </div>
        </div>
      </div>

      {/* Code Editor Right Section */}
      <div className="lg:w-2/3 flex flex-col bg-emerald-950/80 rounded-xl border border-emerald-800/40 overflow-hidden backdrop-blur-md">
        {/* Code Header */}
        <div className="bg-emerald-900/30 border-b border-emerald-800/40 px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-mono text-emerald-400 font-semibold">{selectedFile.name}</span>
            <span className="text-[10px] text-emerald-300/60 font-mono mt-0.5">app/src/main/java/com/islamic/dzikrsalawat/{selectedFile.path}</span>
          </div>
          <button
            onClick={() => handleCopy(selectedFile.content, selectedFile.name)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/40 text-emerald-100 hover:text-emerald-300 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            {copied === selectedFile.name ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy File</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Window */}
        <div className="flex-1 overflow-auto max-h-[460px] lg:max-h-[540px] font-mono text-xs text-slate-300 p-4 leading-relaxed bg-emerald-950/60 backdrop-blur-sm selection:bg-emerald-800/60">
          <pre className="whitespace-pre scrollbar-thin">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
