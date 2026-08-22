import { useState } from "react";
import { Check, Copy, Terminal, ShieldAlert, Cpu, Award } from "lucide-react";

export default function SetupGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const manifestXml = `<!-- Add inside app/src/main/AndroidManifest.xml under the <manifest> tag -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Add inside the <application> tag -->
<service
    android:name=".presentation.service.DhikrPlaybackService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="mediaPlayback" />`;

  const requestPermissionCode = `// Put inside your MainActivity.kt onCreate to request POST_NOTIFICATIONS on Android 13+ (API 33)
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        NOTIFICATION_PERMISSION_CODE
    )
}`;

  return (
    <div id="setup-guide" className="bg-emerald-950/30 backdrop-blur-xl rounded-2xl border border-emerald-700/30 p-5 md:p-6 shadow-2xl flex flex-col gap-6">
      
      <div>
        <h3 className="text-xl font-sans font-bold text-white">Android Integration Guide</h3>
        <p className="text-emerald-200/70 text-xs mt-1">
          Technical specifications, permission handshakes, and optimization setups to guarantee background survival on Android.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Step 1: Permissions */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-emerald-950/60 rounded-xl p-4 border border-emerald-800/40 relative">
            <div className="flex items-center justify-between border-b border-emerald-800/40 pb-2 mb-3">
              <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                <Terminal size={14} />
                1. Required Manifest Declarations
              </span>
              <button
                onClick={() => handleCopy(manifestXml, "manifest")}
                className="text-xs text-emerald-300 hover:text-emerald-400 transition flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === "manifest" ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>Copy</span>
                )}
              </button>
            </div>
            <pre className="text-[11px] text-emerald-200/90 font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
              <code>{manifestXml}</code>
            </pre>
          </div>

          <div className="bg-emerald-950/60 rounded-xl p-4 border border-emerald-800/40 relative">
            <div className="flex items-center justify-between border-b border-emerald-800/40 pb-2 mb-3">
              <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                <Cpu size={14} />
                2. API 33+ Notification Handshake (Kotlin)
              </span>
              <button
                onClick={() => handleCopy(requestPermissionCode, "permissions")}
                className="text-xs text-emerald-300 hover:text-emerald-400 transition flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === "permissions" ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>Copy</span>
                )}
              </button>
            </div>
            <pre className="text-[11px] text-emerald-200/90 font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
              <code>{requestPermissionCode}</code>
            </pre>
          </div>
        </div>

        {/* Column 2: Crucial Tips & System Optimization Hacks */}
        <div className="flex flex-col gap-4">
          
          <div className="bg-red-950/35 border border-red-900/40 rounded-xl p-4 flex flex-col gap-2 backdrop-blur-md">
            <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert size={14} />
              Android Battery & Doze Mitigation
            </h4>
            <p className="text-[11px] text-red-200/90 leading-relaxed">
              Modern Android versions aggressively kill background operations. To guarantee that Sholawat loop counts do not freeze during screen-off cycles:
            </p>
            <ul className="text-[10px] text-red-300/85 list-disc list-inside space-y-1 pl-1">
              <li>Instruct practitioners to disable battery optimization in System Settings specifically for your applet.</li>
              <li>Always specify <code className="text-emerald-400 bg-emerald-950/40 px-1 rounded font-mono">mediaPlayback</code> as the service type.</li>
              <li>ExoPlayer's <code className="text-emerald-400 bg-emerald-950/40 px-1 rounded font-mono">Player.REPEAT_MODE_ONE</code> runs entirely inside native C++ libraries, bypassing standard Kotlin thread freezing.</li>
            </ul>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4 flex flex-col gap-2 backdrop-blur-md">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Award size={14} />
              Ethical Monetization Tip
            </h4>
            <p className="text-[11px] text-emerald-100 leading-relaxed">
              To honor religious mindfulness, do NOT overlay ads during an active player session. Limit banners to the Dhikr Selection dashboard or settings screen. Implement standard Google Mobile Ads (AdMob) safely inside non-scrolling layouts.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
