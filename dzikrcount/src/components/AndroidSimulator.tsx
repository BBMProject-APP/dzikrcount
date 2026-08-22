import { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { 
  Play, 
  Pause, 
  VolumeX, 
  ChevronDown,
  Sparkles, 
  Moon, 
  Volume2,
  Bell,
  Wifi, 
  Battery, 
  Sliders, 
  EyeOff, 
  Check, 
  Accessibility, 
  Mic,
  MicOff,
  Calendar,
  Award,
  TrendingUp,
  Trash2,
  Clock,
  History
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { audioSynth } from "../utils/audioSynth";
import { DhikrType, AmbientLayer } from "../types/dhikr";

interface SessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  dhikrId: string;
  dhikrName: string;
  count: number;
  timestamp: number;
}

const PRESET_DHIKRS: DhikrType[] = [
  {
    id: "sholawat_jibril",
    name: "Sholawat Jibril",
    arabic: "صَلَّى اللهُ عَلَى مُحَمَّد",
    transliteration: "Shallallahu 'Ala Muhammad",
    translation: "May Allah bless Muhammad with His grace.",
    defaultDurationMs: 2500, // speed of simulated auto-loop
    audioFrequency: 1.1, // voice frequency multiplier
  },
  {
    id: "istighfar",
    name: "Istighfar",
    arabic: "أَسْتَغْفِرُ اللهَ الْعَظِيمَ",
    transliteration: "Astaghfirullahal 'Adheem",
    translation: "I seek forgiveness from Allah the Almighty.",
    defaultDurationMs: 2800,
    audioFrequency: 0.9,
  },
  {
    id: "tasbih",
    name: "Tasbih",
    arabic: "سُبْحَانَ اللهِ",
    transliteration: "Subhanallah",
    translation: "Glory be to Allah, far removed from any imperfection.",
    defaultDurationMs: 2000,
    audioFrequency: 1.2,
  },
  {
    id: "sholawat_nariyah",
    name: "Sholawat Nariyah",
    arabic: "اللَّهُمَّ صَلِّ صَلاَةً كَامِلَةً وَسَلِّمْ سَلاَمًا تَامَّا عَلَى مُحَمَّدٍ",
    transliteration: "Allahumma shalli shalaatan kaamilatan...",
    translation: "O Allah, bestow complete blessings and perfect peace...",
    defaultDurationMs: 4000,
    audioFrequency: 0.85,
  }
];

export default function AndroidSimulator() {
  // Core Player State
  const [activeDhikr, setActiveDhikr] = useState<DhikrType>(PRESET_DHIKRS[0]);
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [targetCount, setTargetCount] = useState<number>(100);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Voice & Speech Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [voiceCommandLog, setVoiceCommandLog] = useState<string[]>(["System ready. Waiting for voice activation..."]);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  // Selector overlay
  const [showDhikrList, setShowDhikrList] = useState<boolean>(false);
  const [customTargetInput, setCustomTargetInput] = useState<string>("");
  const [showCustomTargetModal, setShowCustomTargetModal] = useState<boolean>(false);

  // Ambient Sounds
  const [rainVol, setRainVol] = useState<number>(0.2);
  const [streamVol, setStreamVol] = useState<number>(0.0);
  const [droneVol, setDroneVol] = useState<number>(0.0);

  // Device states
  const [isScreenOff, setIsScreenOff] = useState<boolean>(false);
  const [showNotificationShade, setShowNotificationShade] = useState<boolean>(true);
  const [isTalkbackEnabled, setIsTalkbackEnabled] = useState<boolean>(false);
  const [talkbackLog, setTalkbackLog] = useState<string>("TalkBack Inactive");
  const [systemTime, setSystemTime] = useState<string>("08:26 AM");

  // Web Audio activation warning
  const [audioNeedsInteraction, setAudioNeedsInteraction] = useState<boolean>(true);

  // Playback timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Daily Progress Tracker & Session Logs
  const getPastDateString = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>(() => {
    try {
      const stored = localStorage.getItem("dhikr_session_logs");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading localStorage", e);
    }
    // Set seed data initially
    const d = new Date();
    const getSeedDate = (daysAgo: number): string => {
      const dateCopy = new Date(d);
      dateCopy.setDate(dateCopy.getDate() - daysAgo);
      const y = dateCopy.getFullYear();
      const m = String(dateCopy.getMonth() + 1).padStart(2, "0");
      const dd = String(dateCopy.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };
    return [
      { id: "seed-1", date: getSeedDate(6), dhikrId: "tasbih", dhikrName: "Tasbih", count: 330, timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000 },
      { id: "seed-2", date: getSeedDate(5), dhikrId: "sholawat_jibril", dhikrName: "Sholawat Jibril", count: 100, timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 },
      { id: "seed-3", date: getSeedDate(4), dhikrId: "istighfar", dhikrName: "Astaghfirullah", count: 500, timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 },
      { id: "seed-4", date: getSeedDate(3), dhikrId: "tasbih", dhikrName: "Tasbih", count: 330, timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
      { id: "seed-5", date: getSeedDate(2), dhikrId: "sholawat_jibril", dhikrName: "Sholawat Jibril", count: 660, timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 },
      { id: "seed-6", date: getSeedDate(1), dhikrId: "sholawat_nariyah", dhikrName: "Sholawat Nariyah", count: 990, timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000 },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem("dhikr_session_logs", JSON.stringify(sessionLogs));
    } catch (e) {
      console.error("Error writing localStorage", e);
    }
  }, [sessionLogs]);

  // Reminders and Notifications State
  interface DhikrReminder {
    dhikrId: string;
    dhikrName: string;
    enabled: boolean;
    time: string; // "HH:MM" 24h format
  }

  interface SimNotification {
    id: string;
    title: string;
    body: string;
    category: "completion" | "reminder";
    timestamp: string;
  }

  const [reminders, setReminders] = useState<DhikrReminder[]>(() => {
    try {
      const stored = localStorage.getItem("dhikr_reminders");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [
      { dhikrId: "sholawat_jibril", dhikrName: "Sholawat Jibril", enabled: true, time: "08:00" },
      { dhikrId: "tasbih", dhikrName: "Tasbih", enabled: true, time: "18:30" },
      { dhikrId: "istighfar", dhikrName: "Astaghfirullah", enabled: false, time: "05:00" },
    ];
  });

  const [simNotifications, setSimNotifications] = useState<SimNotification[]>(() => {
    try {
      const stored = localStorage.getItem("dhikr_sim_notifications");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: "init",
        title: "Dhikr NotificationManager",
        body: "Daily reminder alarms registered with AlarmManager. Status: Ready.",
        category: "reminder",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  const [headsUpNotif, setHeadsUpNotif] = useState<SimNotification | null>(null);

  const [alarmLogs, setAlarmLogs] = useState<string[]>(() => [
    `[${new Date().toLocaleTimeString()}] [AlarmManager] Loaded active alarms from SharedPrefs.`,
    `[${new Date().toLocaleTimeString()}] [NotificationChannel] Created 'dhikr_reminders_channel' with high prominence.`
  ]);

  // Persist reminders and notifications
  useEffect(() => {
    localStorage.setItem("dhikr_reminders", JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem("dhikr_sim_notifications", JSON.stringify(simNotifications));
  }, [simNotifications]);

  const postSimNotification = (title: string, body: string, category: "completion" | "reminder") => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newNotif: SimNotification = {
      id: `notif-${Date.now()}`,
      title,
      body,
      category,
      timestamp: timeStr
    };

    setSimNotifications(prev => [newNotif, ...prev]);
    audioSynth.playNotificationChime();
    
    // Heads-up banner slide-down
    setHeadsUpNotif(newNotif);
    setTimeout(() => {
      setHeadsUpNotif(prev => prev?.id === newNotif.id ? null : prev);
    }, 4500);

    // Browser native Notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch (e) {
        console.error("Browser notification failed", e);
      }
    }
    
    // Log intent dispatching
    setAlarmLogs(prev => [
      `[${new Date().toLocaleTimeString()}] [BroadcastReceiver] onReceive() -> Posting notification on channel 'dhikr_reminders_channel'`,
      ...prev
    ]);
  };

  // AlarmManager background alarm polling simulator
  useEffect(() => {
    let lastCheckedMinute = "";
    
    const checkAlarms = () => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      
      if (currentHHMM !== lastCheckedMinute) {
        lastCheckedMinute = currentHHMM;
        
        reminders.forEach(reminder => {
          if (reminder.enabled && reminder.time === currentHHMM) {
            postSimNotification(
              "Spiritual Consistency Alert",
              `It's time for your daily session: ${reminder.dhikrName}. Keep up your daily streak!`,
              "reminder"
            );
            setAlarmLogs(prev => [
              `[${new Date().toLocaleTimeString()}] [AlarmManager] RTC_WAKEUP broadcast intent fired for '${reminder.dhikrId}'`,
              ...prev
            ]);
          }
        });
      }
    };

    const alarmInterval = setInterval(checkAlarms, 1000);
    return () => clearInterval(alarmInterval);
  }, [reminders]);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        postSimNotification("Permissions Granted", "Native desktop notifications enabled successfully!", "reminder");
      }
    }
  };

  // Initialize clock
  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      setSystemTime(`${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`);
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 10000);
    return () => clearInterval(clockTimer);
  }, []);

  // Update synthetic ambient audio streams when volumes change
  useEffect(() => {
    if (!audioNeedsInteraction) {
      audioSynth.setRainVolume(rainVol);
    }
  }, [rainVol, audioNeedsInteraction]);

  useEffect(() => {
    if (!audioNeedsInteraction) {
      audioSynth.setStreamVolume(streamVol);
    }
  }, [streamVol, audioNeedsInteraction]);

  useEffect(() => {
    if (!audioNeedsInteraction) {
      audioSynth.setDroneVolume(droneVol);
    }
  }, [droneVol, audioNeedsInteraction]);

  // Talkback speech synthesizer support
  const speakState = (text: string) => {
    if (isTalkbackEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
      setTalkbackLog(`[Spoken]: "${text}"`);
    } else {
      setTalkbackLog(`[Screen Reader]: ${text}`);
    }
  };

  // State refs for avoiding infinite effect rebuilds on Speech Recognition
  const targetCountRef = useRef(targetCount);
  const currentCountRef = useRef(currentCount);

  useEffect(() => {
    targetCountRef.current = targetCount;
  }, [targetCount]);

  useEffect(() => {
    currentCountRef.current = currentCount;
  }, [currentCount]);

  // Helper word to number mapping for voice command parser
  const wordToNumMap: { [key: string]: number } = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000
  };

  const parseSpokenNumber = (text: string): number | null => {
    // Check if there are raw digits in the text (e.g. "33")
    const digitMatch = text.match(/\d+/);
    if (digitMatch) {
      return parseInt(digitMatch[0], 10);
    }

    // Split words and compute total
    const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
    let total = 0;
    let currentVal = 0;
    let foundNumber = false;

    for (const word of words) {
      if (wordToNumMap[word] !== undefined) {
        foundNumber = true;
        const val = wordToNumMap[word];
        if (val === 100) {
          currentVal = (currentVal || 1) * 100;
        } else if (val === 1000) {
          total += (currentVal || 1) * 1000;
          currentVal = 0;
        } else {
          currentVal += val;
        }
      }
    }
    total += currentVal;

    return foundNumber ? total : null;
  };

  const processVoiceCommand = (transcript: string) => {
    const cleanText = transcript.toLowerCase().trim();
    
    // Command matching
    if (cleanText.includes("pause") || cleanText.includes("stop") || cleanText.includes("hold")) {
      setIsPlaying(false);
      speakState("Recitation paused.");
      setVoiceCommandLog(prev => [`[Action]: Paused loop (Spoken: "${transcript}")`, ...prev]);
    } else if (cleanText.includes("resume") || cleanText.includes("play") || cleanText.includes("start") || cleanText.includes("go")) {
      setIsPlaying(true);
      speakState("Recitation resumed.");
      setVoiceCommandLog(prev => [`[Action]: Resumed loop (Spoken: "${transcript}")`, ...prev]);
    } else if (cleanText.includes("reset") || cleanText.includes("clear") || cleanText.includes("restart")) {
      setCurrentCount(0);
      setIsCompleted(false);
      speakState("Counter reset to zero.");
      setVoiceCommandLog(prev => [`[Action]: Reset count to 0 (Spoken: "${transcript}")`, ...prev]);
    } else if (cleanText.includes("count") || cleanText.includes("set") || cleanText.includes("change") || cleanText.includes("target")) {
      const number = parseSpokenNumber(cleanText);
      if (number !== null) {
        if (cleanText.includes("target")) {
          setTargetCount(number);
          speakState(`Target count set to ${number}.`);
          setVoiceCommandLog(prev => [`[Action]: Set target to ${number} (Spoken: "${transcript}")`, ...prev]);
        } else {
          setCurrentCount(number);
          if (number >= targetCountRef.current) {
            setIsCompleted(true);
          } else {
            setIsCompleted(false);
          }
          speakState(`Count set to ${number}.`);
          setVoiceCommandLog(prev => [`[Action]: Set count to ${number} (Spoken: "${transcript}")`, ...prev]);
        }
      } else {
        setVoiceCommandLog(prev => [`[Heard]: "${transcript}" (No matching number found)`, ...prev]);
      }
    } else {
      // Check if user just spoke a plain number
      const number = parseSpokenNumber(cleanText);
      if (number !== null) {
        setCurrentCount(number);
        if (number >= targetCountRef.current) {
          setIsCompleted(true);
        } else {
          setIsCompleted(false);
        }
        speakState(`Count set to ${number}.`);
        setVoiceCommandLog(prev => [`[Action]: Set count to ${number} (Spoken: "${transcript}")`, ...prev]);
      } else {
        setVoiceCommandLog(prev => [`[Heard]: "${transcript}"`, ...prev]);
      }
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
      setVoiceCommandLog(prev => ["Listening active...", ...prev]);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error", event);
      setVoiceCommandLog(prev => [`[Error]: ${event.error || "Speech error occurred"}`, ...prev]);
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript.trim().toLowerCase();
      setVoiceTranscript(transcript);
      processVoiceCommand(transcript);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!isSpeechSupported) return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to start speech recognition", e);
        }
      }
    }
  };

  // Automated audio loop tick simulator
  useEffect(() => {
    if (isPlaying) {
      const triggerLoopTick = () => {
        setCurrentCount(prev => {
          const nextVal = prev + 1;
          
          // Sound effect trigger (calming bead click!)
          audioSynth.playBeadClick(activeDhikr.audioFrequency);

          // Accessibility narration triggers on important boundaries
          if (nextVal % 10 === 0 && nextVal < targetCount) {
            speakState(`Count ${nextVal}`);
          }

          if (nextVal >= targetCount) {
            setIsPlaying(false);
            setIsCompleted(true);
            audioSynth.playCompletionBell();
            speakState(`Completed target ${targetCount} recitations of ${activeDhikr.name}. Alhamdulillah.`);
            
            // Post Simulated Notification
            postSimNotification(
              "Spiritual Goal Met! 🎉",
              `Alhamdulillah, you completed ${targetCount} recitations of ${activeDhikr.name}. Keep it up!`,
              "completion"
            );
            
            // Log completed session automatically
            const todayStr = new Date().toISOString().split("T")[0];
            const newLog: SessionLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              date: todayStr,
              dhikrId: activeDhikr.id,
              dhikrName: activeDhikr.name,
              count: targetCount,
              timestamp: Date.now()
            };
            setSessionLogs(prev => [newLog, ...prev]);

            return targetCount;
          }
          return nextVal;
        });

        // Setup next loop transition based on simulated audio phrase duration
        timerRef.current = setTimeout(triggerLoopTick, activeDhikr.defaultDurationMs / playbackSpeed);
      };

      timerRef.current = setTimeout(triggerLoopTick, activeDhikr.defaultDurationMs / playbackSpeed);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, activeDhikr, targetCount, isTalkbackEnabled, playbackSpeed]);

  // Trigger audio on play activation
  const handlePlayToggle = () => {
    if (audioNeedsInteraction) {
      setAudioNeedsInteraction(false);
      audioSynth.resume();
    }
    
    if (isCompleted) {
      setCurrentCount(0);
      setIsCompleted(false);
    }

    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (nextState) {
      speakState(`Starting ${activeDhikr.name}. Target loop is ${targetCount} times.`);
    } else {
      speakState("Recitation paused.");
    }
  };

  // Critical requirement: EMERGENCY IMMEDIATE SILENCING
  const handleEmergencyMute = () => {
    setIsPlaying(false);
    // Stop all audio generators instantly
    audioSynth.stopAll();
    
    // Set mixer sliders to zero
    setRainVol(0);
    setStreamVol(0);
    setDroneVol(0);
    
    // Reset counter if specified or maintain
    setCurrentCount(0);
    setIsCompleted(false);

    speakState("Emergency Muted! All audio streams suspended instantly.");
  };

  const selectDhikrPreset = (dhikr: DhikrType) => {
    setActiveDhikr(dhikr);
    setCurrentCount(0);
    setIsCompleted(false);
    setShowDhikrList(false);
    speakState(`Selected ${dhikr.name}`);
  };

  const handleCustomTargetSubmit = (e: FormEvent) => {
    e.preventDefault();
    const val = parseInt(customTargetInput);
    if (!isNaN(val) && val > 0) {
      setTargetCount(val);
      setCurrentCount(0);
      setIsCompleted(false);
      setShowCustomTargetModal(false);
      speakState(`Target set to ${val} repetitions.`);
    }
  };

  // Daily Progress Dashboard calculations
  const totalCountAllTime = useMemo(() => {
    return sessionLogs.reduce((sum, log) => sum + log.count, 0);
  }, [sessionLogs]);

  const streak = useMemo(() => {
    let count = 0;
    let checkDate = new Date();
    
    // Safety break to prevent infinite loops if something goes wrong with Date math
    let iterations = 0;
    while (iterations < 100) {
      iterations++;
      const checkDateStr = checkDate.toISOString().split("T")[0];
      const hasLog = sessionLogs.some(log => log.date === checkDateStr && log.count > 0);
      
      if (hasLog) {
        count++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (count === 0) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];
          const hasLogYesterday = sessionLogs.some(log => log.date === yesterdayStr && log.count > 0);
          if (hasLogYesterday) {
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return count;
  }, [sessionLogs]);

  const chartData = useMemo(() => {
    const days = [];
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayName = daysOfWeek[d.getDay()];
      
      const totalCount = sessionLogs
        .filter(log => log.date === dateStr)
        .reduce((sum, log) => sum + log.count, 0);
        
      days.push({
        dateStr,
        label: `${dayName} ${label}`,
        count: totalCount,
      });
    }
    return days;
  }, [sessionLogs]);

  const dhikrStats = useMemo(() => {
    const stats: { [key: string]: number } = {};
    sessionLogs.forEach(log => {
      stats[log.dhikrName] = (stats[log.dhikrName] || 0) + log.count;
    });
    return Object.entries(stats).map(([name, count]) => ({ name, count }));
  }, [sessionLogs]);

  const handleManualLog = (count: number) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const newLog: SessionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: todayStr,
      dhikrId: activeDhikr.id,
      dhikrName: activeDhikr.name,
      count: count,
      timestamp: Date.now()
    };
    setSessionLogs(prev => [newLog, ...prev]);
    speakState(`Manually logged ${count} recitations of ${activeDhikr.name}.`);
  };

  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to clear your daily progress logs?")) {
      setSessionLogs([]);
      speakState("All recitation logs have been cleared.");
    }
  };

  // Calculate percentage fill for elegant circular tracker
  const completionPercentage = (currentCount / targetCount) * 100;
  // Arc math for SVG progress circle
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
      
      {/* LEFT: Phone Simulator Frame Wrapper */}
      <div className="w-full max-w-[390px] mx-auto flex flex-col items-center">
        
        {/* Device Wrapper */}
        <div className="relative w-full aspect-[9/19.5] bg-emerald-950/40 backdrop-blur-xl rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(16,185,129,0.4)] border-4 border-emerald-800/60 flex flex-col overflow-hidden">
          
          {/* Speaker, camera notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-emerald-950 rounded-b-2xl z-40 flex items-center justify-center border-b border-x border-emerald-900/30">
            <div className="w-12 h-1 bg-emerald-800 rounded-full mb-1"></div>
          </div>

          {/* SIMULATED PHONE SCREEN */}
          <div className="flex-1 rounded-[36px] overflow-hidden bg-emerald-950/80 relative flex flex-col select-none border border-emerald-700/30">
            
            {/* SCREEN-OFF COVER OVERLAY (Pocket mode simulation) */}
            {isScreenOff && (
              <div 
                onClick={() => {
                  setIsScreenOff(false);
                  speakState("Display activated.");
                }}
                className="absolute inset-0 bg-black/98 z-50 flex flex-col items-center justify-center cursor-pointer p-6"
              >
                <div className="animate-ping w-3 h-3 bg-emerald-500 rounded-full mb-6"></div>
                <p className="text-emerald-400/80 font-mono text-xs text-center">Foreground Service Active</p>
                <p className="text-emerald-500/60 text-[10px] text-center mt-2 max-w-[200px]">Background audio and counting loops survive Doze Mode. Tap screen to wake.</p>
                <div className="mt-8 bg-emerald-950/90 border border-emerald-800/40 p-3 rounded-xl w-full backdrop-blur-md">
                  <div className="text-center text-emerald-300 text-xs font-mono">Simulated Headset Stats</div>
                  <div className="text-center text-emerald-400 text-lg font-bold font-mono mt-1">
                    {currentCount} / {targetCount}
                  </div>
                  <div className="text-[10px] text-emerald-200/60 text-center mt-0.5">{activeDhikr.name}</div>
                </div>
              </div>
            )}

            {/* Android System Status Bar */}
            <div className="bg-emerald-950/80 text-emerald-300/80 text-[11px] font-medium h-7 px-6 flex items-center justify-between shrink-0 z-30 border-b border-emerald-900/30">
              <span>{systemTime}</span>
              <div className="flex items-center gap-1.5">
                <Wifi size={11} className="text-emerald-400" />
                <Battery size={13} className="text-emerald-400 rotate-90" />
                <span className="text-[9px]">98%</span>
              </div>
            </div>

            {/* HEADS-UP NOTIFICATION OVERLAY */}
            {headsUpNotif && (
              <div className="absolute top-8 left-3.5 right-3.5 bg-emerald-950/95 border border-emerald-500/60 p-3 rounded-2xl z-50 shadow-[0_12px_24px_-4px_rgba(0,0,0,0.6),0_0_12px_rgba(16,185,129,0.3)] flex gap-2.5 items-start text-left backdrop-blur-lg animate-in slide-in-from-top-4 duration-300">
                <div className="w-8 h-8 rounded-full bg-emerald-900/80 border border-emerald-700/50 flex items-center justify-center shrink-0 text-emerald-400">
                  <Bell size={14} className="animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
                      {headsUpNotif.category === "completion" ? "Goal Reached" : "Dhikr Reminder"}
                    </span>
                    <span className="text-[8px] text-emerald-300/60 font-mono">{headsUpNotif.timestamp}</span>
                  </div>
                  <h4 className="text-[11px] font-bold text-white mt-0.5 truncate">{headsUpNotif.title}</h4>
                  <p className="text-[10px] text-emerald-200/80 mt-0.5 leading-snug">{headsUpNotif.body}</p>
                </div>
                <button 
                  onClick={() => setHeadsUpNotif(null)} 
                  className="text-emerald-400 hover:text-white text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* MOCK NOTIFICATION DRAWER / BACKGROUND MEDIA CONTROL BINDING */}
            {showNotificationShade && (
              <div className="bg-emerald-950/95 border-b border-emerald-800/50 p-3 z-30 animate-fade-in shrink-0 backdrop-blur-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <Sparkles size={11} className="text-emerald-400" />
                    <span className="text-[9px] text-emerald-300 font-bold tracking-wider uppercase font-mono">Dhikr Media Controller</span>
                  </div>
                  <span className="text-[8px] text-emerald-400 font-mono">FOREGROUND SERVICE</span>
                </div>
                <div className="bg-emerald-900/40 border border-emerald-700/40 rounded-xl p-2.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center shrink-0">
                    <Moon size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold text-white truncate">{activeDhikr.name}</h4>
                    <p className="text-[9px] text-emerald-300/80 mt-0.5">
                      Completed: <span className="text-emerald-400 font-mono font-bold">{currentCount}/{targetCount}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={handlePlayToggle}
                      className="p-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded-lg transition cursor-pointer"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                    </button>
                    <button 
                      onClick={handleEmergencyMute}
                      className="p-1.5 bg-red-950/80 border border-red-900/50 hover:bg-red-900/50 text-red-300 rounded-lg transition cursor-pointer"
                      title="EMERGENCY STOP"
                    >
                      <VolumeX size={10} />
                    </button>
                  </div>
                </div>

                {/* Recent Notifications inside Shade */}
                <div className="mt-2.5 space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                  <div className="flex items-center justify-between border-t border-emerald-800/30 pt-2 mb-1">
                    <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-mono font-bold">System Alerts</span>
                    {simNotifications.length > 0 && (
                      <button 
                        onClick={() => setSimNotifications([])} 
                        className="text-[8px] text-emerald-300 hover:text-emerald-100 underline font-mono cursor-pointer"
                      >
                        Dismiss All
                      </button>
                    )}
                  </div>
                  
                  {simNotifications.length === 0 ? (
                    <p className="text-[9px] text-emerald-400/50 text-center py-2 italic font-sans">No active notifications</p>
                  ) : (
                    simNotifications.map((notif) => (
                      <div key={notif.id} className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-2 flex gap-2 items-start text-left relative group">
                        <div className={`p-1 rounded-full text-xs mt-0.5 shrink-0 ${
                          notif.category === 'completion' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/30'
                        }`}>
                          <Bell size={10} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-emerald-300">{notif.title}</span>
                            <span className="text-[7px] text-emerald-400/50 font-mono">{notif.timestamp}</span>
                          </div>
                          <p className="text-[9px] text-emerald-200/80 mt-0.5 leading-snug">{notif.body}</p>
                        </div>
                        <button
                          onClick={() => setSimNotifications(prev => prev.filter(n => n.id !== notif.id))}
                          className="text-[8px] text-emerald-500 hover:text-red-400 absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MAIN APP CONTAINER */}
            <div className="flex-1 flex flex-col p-4 overflow-y-auto scrollbar-none justify-between bg-gradient-to-b from-emerald-950/80 via-emerald-900/40 to-emerald-950/90 backdrop-blur-md">
              
              {/* APP BAR */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                  <span className="text-xs font-sans font-bold text-emerald-100 tracking-wide uppercase">Dhikr Player</span>
                </div>
                <button 
                  onClick={() => setShowNotificationShade(!showNotificationShade)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full border transition cursor-pointer ${
                    showNotificationShade 
                      ? "bg-emerald-900 border-emerald-500/40 text-emerald-200" 
                      : "bg-emerald-900/30 border-emerald-800/40 text-emerald-300"
                  }`}
                >
                  {showNotificationShade ? "Hide Notification" : "Show Notification"}
                </button>
              </div>

              {/* WEB AUDIO BROWSER ENGAGEMENT TOAST */}
              {audioNeedsInteraction && (
                <div 
                  onClick={() => {
                    setAudioNeedsInteraction(false);
                    audioSynth.resume();
                  }}
                  className="bg-emerald-950/90 border border-emerald-500/40 rounded-xl p-2.5 text-center cursor-pointer hover:bg-emerald-900 transition my-1 z-20"
                >
                  <p className="text-[10px] text-emerald-300 font-semibold flex items-center justify-center gap-1">
                    <Volume2 size={12} className="animate-bounce" />
                    TAP TO ENABLE SYNTHESIZED SOUNDS
                  </p>
                  <p className="text-[8px] text-slate-400 mt-0.5">Enables authentic wooden-bead click feedback & ambient layers.</p>
                </div>
              )}

              {/* ACTIVE DHIKR SELECTOR CARD */}
              <div className="relative">
                <div 
                  onClick={() => setShowDhikrList(!showDhikrList)}
                  className="bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/40 rounded-2xl p-3 cursor-pointer transition flex items-center justify-between backdrop-blur-md"
                >
                  <div>
                    <span className="text-[9px] text-emerald-400/80 font-bold uppercase tracking-wider font-mono">Current Dhikr Source</span>
                    <h3 className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1">
                      {activeDhikr.name}
                      <ChevronDown size={14} className="text-emerald-300" />
                    </h3>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                    <Sparkles size={14} />
                  </div>
                </div>

                {/* DROPDOWN OVERLAY PRESSETS */}
                {showDhikrList && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-emerald-950/95 border border-emerald-700/50 rounded-2xl p-2 shadow-2xl z-40 animate-fade-in backdrop-blur-xl">
                    <div className="text-[9px] text-emerald-300 px-2.5 py-1 font-bold">Select Preset Dhikr & Salawat</div>
                    {PRESET_DHIKRS.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => selectDhikrPreset(item)}
                        className={`p-2.5 rounded-xl cursor-pointer transition text-left ${
                          activeDhikr.id === item.id 
                            ? "bg-emerald-900/60 text-emerald-200 border-l-2 border-emerald-400" 
                            : "text-emerald-100 hover:bg-emerald-900/50"
                        }`}
                      >
                        <div className="text-xs font-bold">{item.name}</div>
                        <div className="text-[10px] text-emerald-300/70 truncate mt-0.5">{item.transliteration}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TEXT SYNCHRONIZATION AND SACRED TYPOGRAPHY */}
              <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-2xl p-3.5 my-2 text-center flex flex-col justify-center items-center min-h-[110px] backdrop-blur-md">
                <p 
                  className={`text-2xl font-semibold text-emerald-300 tracking-wide font-serif mb-1.5 transition-transform duration-300 ${
                    isPlaying ? "scale-105 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" : ""
                  }`}
                  dir="rtl"
                >
                  {activeDhikr.arabic}
                </p>
                <p className="text-[11px] text-white font-sans leading-tight italic">
                  {activeDhikr.transliteration}
                </p>
                <p className="text-[9px] text-emerald-300/60 font-sans mt-1 max-w-[220px]">
                  {activeDhikr.translation}
                </p>
              </div>

              {/* BREATHING CIRCULAR TRACKER */}
              <div className="flex justify-center items-center my-1 relative">
                
                {/* BREATHING BACKGROUND PULSE RADIUS */}
                <div 
                  className={`absolute w-44 h-44 rounded-full bg-emerald-500/5 transition-transform duration-[3000ms] ease-in-out ${
                    isPlaying ? "scale-125" : "scale-100"
                  }`}
                />

                {/* TRACKER SVG PROGRESS PANEL */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    {/* Background Ring */}
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      className="stroke-emerald-950/60"
                      strokeWidth="6"
                      fill="transparent"
                    />
                    {/* Active Breathing Progress Segment */}
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      className="stroke-emerald-400 transition-all duration-300 ease-out"
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  {/* Centered Counter data */}
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white tracking-tight drop-shadow-[0_2px_10px_rgba(16,185,129,0.3)]">{currentCount}</span>
                    <span className="text-[10px] text-emerald-300/70 font-mono mt-0.5">of {targetCount}</span>
                    <span 
                      className={`text-[8px] font-bold tracking-widest uppercase mt-2 px-1.5 py-0.5 rounded ${
                        isPlaying 
                          ? "bg-emerald-900/60 border border-emerald-700/40 text-emerald-300" 
                          : "bg-emerald-950/60 text-emerald-400"
                      }`}
                    >
                      {isPlaying ? "Reciting" : "Paused"}
                    </span>
                  </div>
                </div>
              </div>

              {/* TARGET REPETITIONS SELECTOR BAR */}
              <div className="flex items-center justify-between gap-1 bg-emerald-950/60 border border-emerald-800/50 p-1 rounded-xl">
                {[33, 100, 1000].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setTargetCount(num);
                      setCurrentCount(0);
                      setIsCompleted(false);
                      speakState(`Target set to ${num}`);
                    }}
                    className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                      targetCount === num && !showCustomTargetModal
                        ? "bg-emerald-500 text-emerald-950 font-extrabold shadow-sm"
                        : "text-emerald-300/80 hover:text-white"
                    }`}
                  >
                    {num}x
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomTargetModal(true)}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                    showCustomTargetModal || ![33, 100, 1000].includes(targetCount)
                      ? "bg-emerald-500 text-emerald-950 font-extrabold shadow-sm"
                      : "text-emerald-300/80 hover:text-white"
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* PLAYBACK SPEED CONTROLLER */}
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-2xl p-2.5 my-1 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-emerald-300 font-semibold tracking-wider flex items-center gap-1 uppercase">
                    <Sliders size={10} className="text-emerald-400" />
                    Playback Speed
                  </span>
                  <span className="text-[8px] font-mono text-emerald-300 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">{playbackSpeed}x</span>
                </div>
                
                <div className="flex items-center gap-1 bg-emerald-950/50 p-0.5 rounded-lg border border-emerald-800/20">
                  {[0.5, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => {
                        setPlaybackSpeed(speed);
                        speakState(`Playback speed set to ${speed}x`);
                      }}
                      className={`flex-1 text-[9px] font-bold py-1 rounded transition-all cursor-pointer ${
                        playbackSpeed === speed
                          ? "bg-emerald-500 text-emerald-950 font-extrabold shadow-sm"
                          : "text-emerald-300/80 hover:text-white"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* AMBIENT MIXER CONTAINER */}
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-2xl p-2.5 my-1 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-emerald-300 font-semibold tracking-wider flex items-center gap-1 uppercase">
                    <Sliders size={10} className="text-emerald-400" />
                    Ambient Soundscapes
                  </span>
                  <span className="text-[8px] text-emerald-400/60">HTML5 Synth Mixer</span>
                </div>
                
                {/* RAIN LOOP */}
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-[9px] text-emerald-200 w-12 truncate">Rain Loop</span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={rainVol}
                    onChange={(e) => setRainVol(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <span className="text-[8px] font-mono text-emerald-300 w-5 text-right">{Math.round(rainVol * 100)}%</span>
                </div>

                {/* WATER STREAM */}
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-[9px] text-emerald-200 w-12 truncate">Stream</span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={streamVol}
                    onChange={(e) => setStreamVol(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <span className="text-[8px] font-mono text-emerald-300 w-5 text-right">{Math.round(streamVol * 100)}%</span>
                </div>

                {/* MASJID DRONE / PAD */}
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-[9px] text-emerald-200 w-12 truncate">Masjid Pad</span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={droneVol}
                    onChange={(e) => setDroneVol(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <span className="text-[8px] font-mono text-emerald-300 w-5 text-right">{Math.round(droneVol * 100)}%</span>
                </div>
              </div>

              {/* HANDS-FREE VOICE CONTROL MIC SWITCH */}
              <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-2xl p-2.5 my-1 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      {isListening ? (
                        <>
                          <span className="absolute -inset-0.5 rounded-full bg-emerald-400/50 animate-ping"></span>
                          <Mic size={14} className="text-emerald-400 relative z-10 animate-pulse" />
                        </>
                      ) : (
                        <MicOff size={14} className="text-emerald-500/50" />
                      )}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] text-emerald-100 font-bold flex items-center gap-1">
                        Hands-Free Voice Mode
                        {isListening && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />}
                      </span>
                      <span className="text-[8px] text-emerald-300/60 font-medium">Pause/resume using voice commands</span>
                    </div>
                  </div>
                  <button
                    onClick={toggleListening}
                    disabled={!isSpeechSupported}
                    className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      !isSpeechSupported
                        ? "bg-emerald-950 text-emerald-800 border border-emerald-900/30 cursor-not-allowed"
                        : isListening
                        ? "bg-red-500 text-white font-black shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                        : "bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/40"
                    }`}
                  >
                    {!isSpeechSupported ? "Unsupported" : isListening ? "Stop Mic" : "Start Mic"}
                  </button>
                </div>

                {isListening && (
                  <div className="mt-2 pt-2 border-t border-emerald-900/40 text-left">
                    <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-mono font-bold block mb-1">Live Voice Input:</span>
                    <div className="bg-emerald-950/80 rounded px-2 py-1 border border-emerald-900/30 text-[9px] text-emerald-200 font-mono italic truncate">
                      {voiceTranscript ? `"${voiceTranscript}"` : "Say 'pause', 'resume', or a count number..."}
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM CONTROLS & EMERGENCY PAUSE */}
              <div className="flex gap-2.5 items-center mt-1 z-20">
                <button
                  onClick={handlePlayToggle}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition shadow-md cursor-pointer ${
                    isPlaying 
                      ? "bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/40" 
                      : "bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause size={14} fill="currentColor" />
                      <span>PAUSE</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="currentColor" />
                      <span>RECITE</span>
                    </>
                  )}
                </button>

                {/* MANDATORY PROMINENT EMERGENCY BUTTON */}
                <button
                  onClick={handleEmergencyMute}
                  className="px-3 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-[10px] font-black tracking-wider transition-all shadow-md shrink-0 flex items-center gap-1 cursor-pointer border border-red-500/30"
                  title="EMERGENCY MUTE ALL SOUNDS"
                >
                  <VolumeX size={14} className="animate-pulse" />
                  <span>EMERGENCY STOP</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* CUSTOM TARGET INPUT MODAL (SIMULATED SCREEN POPUP) */}
        {showCustomTargetModal && (
          <div className="fixed inset-0 bg-[#021814]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-emerald-950/90 border border-emerald-700/40 rounded-3xl p-5 max-w-[280px] w-full text-center shadow-2xl animate-scale-up backdrop-blur-xl">
              <h4 className="text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Sliders size={16} className="text-emerald-400" />
                Custom Loop Target
              </h4>
              <p className="text-[11px] text-emerald-300/80 mt-1">Specify your exact recitation target before automatic service halt.</p>
              
              <form onSubmit={handleCustomTargetSubmit} className="mt-4 flex flex-col gap-2">
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={customTargetInput}
                  onChange={(e) => setCustomTargetInput(e.target.value)}
                  className="bg-emerald-900/40 border border-emerald-800 rounded-xl px-3 py-2 text-center text-white text-sm focus:outline-none focus:border-emerald-400 font-mono"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomTargetModal(false)}
                    className="flex-1 py-2 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/40 text-emerald-200 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* RIGHT: Simulator Controls / Companion Dashboard */}
      <div className="flex-1 bg-emerald-950/30 backdrop-blur-xl rounded-2xl border border-emerald-700/30 p-5 md:p-6 shadow-2xl flex flex-col gap-5">
        
        <div>
          <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-700/50 rounded-full text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">Interactive Dev Simulator Workspace</span>
          <h3 className="text-xl font-sans font-semibold text-white mt-3">Test Foreground Audio Lifecycles</h3>
          <p className="text-emerald-200/70 text-xs mt-1">
            Experience how the Jetpack Media3 implementation behaves on real devices when handling system-level restrictions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* SIMULATION CONTROLS */}
          <div className="bg-emerald-950/50 border border-emerald-800/40 p-4 rounded-xl flex flex-col gap-4 backdrop-blur-sm">
            <h4 className="text-xs font-bold text-emerald-300 border-b border-emerald-800/60 pb-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-400" />
              OS-Level Simulators
            </h4>

            {/* SCREEN OFF MODE TOGGLE */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => {
                  setIsScreenOff(true);
                  speakState("Display locked. Background audio playback service remains active.");
                }}
                className="p-2 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/40 hover:border-emerald-500/40 text-emerald-300 hover:text-white rounded-xl transition cursor-pointer shrink-0"
              >
                <EyeOff size={16} />
              </button>
              <div>
                <button 
                  onClick={() => setIsScreenOff(true)} 
                  className="text-xs font-bold text-white block hover:text-emerald-400 transition cursor-pointer text-left"
                >
                  Simulate Pocket / Screen-Off Mode
                </button>
                <p className="text-[10px] text-emerald-300/70 mt-0.5 leading-relaxed">
                  Mimics locking the device. The Media3 Foreground Service survives the Android Doze state and prevents garbage collection.
                </p>
              </div>
            </div>

            {/* NOTIFICATION SHADE TOGGLE */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => setShowNotificationShade(!showNotificationShade)}
                className={`p-2 rounded-xl transition cursor-pointer shrink-0 border ${
                  showNotificationShade 
                    ? "bg-emerald-900 border-emerald-500/40 text-white" 
                    : "bg-emerald-900/40 border-emerald-800/40 text-emerald-300"
                }`}
              >
                <Bell size={16} />
              </button>
              <div>
                <button 
                  onClick={() => setShowNotificationShade(!showNotificationShade)} 
                  className="text-xs font-bold text-white block hover:text-emerald-400 transition cursor-pointer text-left"
                >
                  Toggle Android Status Shade
                </button>
                <p className="text-[10px] text-emerald-300/70 mt-0.5 leading-relaxed">
                  Displays the system media notification drawer. Try controlling playback or issuing an Emergency Stop from outside the app container!
                </p>
              </div>
            </div>

          </div>

          {/* ACCESSIBILITY & COMPLIANCE PANEL */}
          <div className="bg-emerald-950/50 border border-emerald-800/40 p-4 rounded-xl flex flex-col gap-3 backdrop-blur-sm">
            <h4 className="text-xs font-bold text-emerald-300 border-b border-emerald-800/60 pb-2 flex items-center gap-1.5">
              <Accessibility size={13} className="text-emerald-400" />
              Accessibility & TalkBack
            </h4>

            <div className="flex items-center justify-between bg-emerald-900/30 border border-emerald-800/40 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <Accessibility size={14} className={isTalkbackEnabled ? "text-emerald-400 animate-pulse" : "text-emerald-600"} />
                <span className="text-xs font-bold text-white">Simulate Screen Reader</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={isTalkbackEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsTalkbackEnabled(next);
                    if (next) {
                      setTimeout(() => speakState("TalkBack On. Selected Dhikr, Sholawat Jibril."), 100);
                    } else {
                      setTalkbackLog("TalkBack Inactive");
                    }
                  }}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-emerald-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-emerald-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-emerald-800 after:border-emerald-700 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-emerald-950 peer-checked:after:border-emerald-400"></div>
              </label>
            </div>

            <div className="bg-emerald-950/80 rounded-lg p-2.5 border border-emerald-800/60 flex flex-col justify-between flex-1 min-h-[70px]">
              <div className="text-[9px] font-mono text-emerald-400/60 uppercase tracking-wide">TTS Speech Monitor log</div>
              <div className="text-xs text-emerald-200 font-mono mt-1 leading-relaxed break-words">
                {talkbackLog}
              </div>
            </div>
          </div>

        </div>

        {/* HANDS-FREE VOICE RECOGNITION CONSOLE - COMPANION DASHBOARD */}
        <div className="bg-emerald-950/50 border border-emerald-800/40 p-4 rounded-xl flex flex-col gap-3 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Mic size={14} className="text-emerald-400" />
              Hands-Free Speech Command Console
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/30">
              SpeechRecognizer Binding
            </span>
          </div>
          
          <p className="text-xs text-emerald-200/70 leading-relaxed font-sans">
            Control the recitation hands-free. Web Speech API translates your voice commands in real-time, matching Android's native offline <code className="text-emerald-400 bg-emerald-950/40 px-1 rounded font-mono">SpeechRecognizer</code> engine to preserve complete focus during count updates.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            {/* Command Cheatsheet */}
            <div className="bg-emerald-950/60 border border-emerald-800/30 rounded-lg p-3">
              <div className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider font-bold mb-2">Supported Voice Commands</div>
              <ul className="text-[10px] text-emerald-200/90 space-y-1.5 list-disc pl-3">
                <li><strong>"Pause" / "Stop" / "Hold"</strong>: Pauses recitation</li>
                <li><strong>"Resume" / "Play" / "Start"</strong>: Resumes loop</li>
                <li><strong>"Reset" / "Clear"</strong>: Resets counter to 0</li>
                <li><strong>"[Number]"</strong> (e.g., <i>"thirty-three"</i>): Jump to count</li>
                <li><strong>"Set target to [Number]"</strong>: Adjust target</li>
              </ul>
            </div>

            {/* Voice Command Log */}
            <div className="bg-emerald-950/80 border border-emerald-800/40 rounded-lg p-3 flex flex-col justify-between h-[125px]">
              <div className="text-[9px] font-mono text-emerald-400/60 uppercase tracking-wide border-b border-emerald-900/40 pb-1 mb-1">Voice Action Activity Log</div>
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin text-[11px] font-mono text-emerald-200/95 space-y-1">
                {voiceCommandLog.slice(0, 4).map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PLAYBACK SPEED CONTROLLER - COMPANION DASHBOARD */}
        <div className="bg-emerald-950/50 border border-emerald-800/40 p-4 rounded-xl flex flex-col gap-3 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Sliders size={13} className="text-emerald-400" />
              Jetpack Media3 Playback Speed Tuning
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/30">
              ExoPlayer.setPlaybackParameters()
            </span>
          </div>
          <p className="text-xs text-emerald-200/70 leading-relaxed font-sans">
            Configure the recitation pacing rate. ExoPlayer's time-stretching processing preserves voice resonance (formants) perfectly without any high-pitched or low-pitched pitch distortions.
          </p>
          <div className="flex flex-col gap-2 mt-1 font-sans">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-100">Speed Ratio:</span>
              <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded">{playbackSpeed}x Speed</span>
            </div>
            <input 
              type="range"
              min="0.5"
              max="2.0"
              step="0.25"
              value={playbackSpeed}
              onChange={(e) => {
                const speed = parseFloat(e.target.value);
                setPlaybackSpeed(speed);
                speakState(`Playback speed adjusted to ${speed}x`);
              }}
              className="w-full h-1 bg-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-emerald-400/60 font-mono">
              <span>0.5x (Slow)</span>
              <span>1.0x (Normal)</span>
              <span>1.5x</span>
              <span>2.0x (Fast)</span>
            </div>
          </div>
        </div>

        {/* SPIRITUAL CONSISTENCY & DAILY PROGRESS DASHBOARD */}
        <div className="bg-emerald-950/50 border border-emerald-800/40 p-4 rounded-xl flex flex-col gap-4 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-400" />
              Daily Progress & Spiritual Consistency
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/30">
              SpiritualDashboard Binding
            </span>
          </div>

          <p className="text-xs text-emerald-200/70 leading-relaxed font-sans">
            Track your recitation consistency. Cumulative counts are saved to your local persistence layer, replicating native Android SQLite <code className="text-emerald-400 bg-emerald-950/40 px-1 rounded font-mono">Room</code> database architecture.
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-emerald-950/80 border border-emerald-900/50 p-2.5 rounded-lg flex flex-col justify-between">
              <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-mono font-bold flex items-center gap-1">
                <Clock size={10} />
                Total Counts
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">{totalCountAllTime}</span>
              <span className="text-[8px] text-emerald-300/50">All sessions combined</span>
            </div>

            <div className="bg-emerald-950/80 border border-emerald-900/50 p-2.5 rounded-lg flex flex-col justify-between font-sans">
              <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-mono font-bold flex items-center gap-1">
                <Award size={10} />
                Daily Streak
              </span>
              <span className="text-sm font-black text-amber-400 font-mono mt-1 flex items-center gap-0.5 truncate">
                🔥 {streak} {streak === 1 ? 'day' : 'days'}
              </span>
              <span className="text-[8px] text-emerald-300/50">Consecutive days active</span>
            </div>

            <div className="bg-emerald-950/80 border border-emerald-900/50 p-2.5 rounded-lg flex flex-col justify-between font-sans">
              <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-mono font-bold flex items-center gap-1">
                <Calendar size={10} />
                Sessions
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">{sessionLogs.length}</span>
              <span className="text-[8px] text-emerald-300/50">Stored in Room DB</span>
            </div>
          </div>

          {/* Recharts Weekly Summary Bar Chart */}
          <div className="bg-emerald-950/70 border border-emerald-900/40 rounded-lg p-3">
            <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-mono font-bold block mb-3">7-Day Consistency (Weekly Summary)</span>
            
            <div className="w-full h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#6ee7b7" 
                    fontSize={8} 
                    tickLine={false}
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#6ee7b7" 
                    fontSize={8} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#064e3b", 
                      borderColor: "#047857",
                      borderRadius: "8px",
                      fontSize: "10px",
                      color: "#ecfdf5",
                      fontFamily: "monospace"
                    }}
                    itemStyle={{ color: "#34d399" }}
                    labelStyle={{ fontWeight: "bold", color: "#6ee7b7" }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Toolbar for Quick Log & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-2.5">
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold text-white">Quick Log Simulator Toolbar</span>
              <span className="text-[8px] text-emerald-300/60 font-medium">Add completed loops directly to test charts</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleManualLog(33)}
                className="text-[9px] font-bold px-2 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded border border-emerald-700/40 cursor-pointer transition-all"
              >
                +33
              </button>
              <button
                onClick={() => handleManualLog(100)}
                className="text-[9px] font-bold px-2 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded border border-emerald-700/40 cursor-pointer transition-all"
              >
                +100
              </button>
              <button
                onClick={() => handleManualLog(500)}
                className="text-[9px] font-bold px-2 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded border border-emerald-700/40 cursor-pointer transition-all"
              >
                +500
              </button>
              <button
                onClick={handleClearLogs}
                title="Reset Database"
                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded border border-red-900/40 cursor-pointer transition-all ml-1 animate-pulse"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Recent History Table */}
          {sessionLogs.length > 0 && (
            <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-lg p-3">
              <div className="flex items-center justify-between border-b border-emerald-900/30 pb-1.5 mb-2">
                <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <History size={10} />
                  Recent Session History
                </span>
                <span className="text-[8px] text-emerald-400/60 font-mono">SQLite Room log</span>
              </div>
              
              <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1 scrollbar-thin font-mono text-[10px]">
                {sessionLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex justify-between items-center py-1 border-b border-emerald-900/10 last:border-0">
                    <div className="flex flex-col text-left">
                      <span className="text-white font-semibold truncate max-w-[150px]">{log.dhikrName}</span>
                      <span className="text-[8px] text-emerald-400/50">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.date}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold">+{log.count} rep</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DAILY DHIKR REMINDERS & ALARMMANAGER SIMULATOR */}
        <div className="bg-emerald-950/50 border border-emerald-800/40 p-4 rounded-xl flex flex-col gap-4 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Bell size={14} className="text-emerald-400" />
              Daily Spiritual Reminders (AlarmManager)
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/30">
              AlarmManager Binding
            </span>
          </div>

          <p className="text-xs text-emerald-200/70 leading-relaxed font-sans">
            Configure daily alarms that wake the device and trigger gentle recitation sessions. In Android, this leverages <code className="text-emerald-400 bg-emerald-950/40 px-1 rounded font-mono">AlarmManager</code> with exact RTC_WAKEUP alarms to bypass standard OS battery-saver restrictions (Doze Mode).
          </p>

          {/* Browser Notification Permission requestor */}
          <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-2.5">
            <div className="flex flex-col text-left font-sans">
              <span className="text-[10px] font-bold text-white">Browser Push Notifications</span>
              <span className="text-[8px] text-emerald-300/60 font-medium">Link simulation with your system alerts</span>
            </div>
            
            <button
              onClick={requestNotificationPermission}
              className={`text-[9px] font-bold px-2.5 py-1 rounded border transition-all cursor-pointer ${
                "Notification" in window && Notification.permission === "granted"
                  ? "bg-emerald-950 border-emerald-600/50 text-emerald-300"
                  : "bg-emerald-800 hover:bg-emerald-700 border-emerald-600 text-white"
              }`}
            >
              {"Notification" in window && Notification.permission === "granted" ? "Enabled ✔" : "Request Permission"}
            </button>
          </div>

          {/* Reminders List */}
          <div className="space-y-2.5 font-sans">
            {reminders.map((reminder) => {
              const preset = PRESET_DHIKRS.find(p => p.id === reminder.dhikrId);
              return (
                <div key={reminder.dhikrId} className="bg-emerald-950/70 border border-emerald-900/50 rounded-xl p-3 flex flex-col gap-2.5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-white">{reminder.dhikrName}</h5>
                      <span className="text-[9px] text-emerald-400/50 italic">{preset?.transliteration}</span>
                    </div>
                    
                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={reminder.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setReminders(prev => prev.map(r => r.dhikrId === reminder.dhikrId ? { ...r, enabled: checked } : r));
                          
                          const logMsg = checked 
                            ? `[${new Date().toLocaleTimeString()}] [AlarmManager] Registered RTC_WAKEUP exact alarm at ${reminder.time} for '${reminder.dhikrId}'`
                            : `[${new Date().toLocaleTimeString()}] [AlarmManager] Cancelled scheduled alarm for '${reminder.dhikrId}'`;
                          
                          setAlarmLogs(prev => [logMsg, ...prev]);
                          speakState(`${reminder.dhikrName} reminder ${checked ? "enabled" : "disabled"}.`);
                        }}
                        className="sr-only peer" 
                      />
                      <div className="w-8 h-4 bg-emerald-900/80 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-emerald-700 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-emerald-950"></div>
                    </label>
                  </div>

                  {/* Time Input and Action Row */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-emerald-900/30">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-emerald-300 font-mono">Alarm Time:</span>
                      <input 
                        type="time" 
                        value={reminder.time}
                        onChange={(e) => {
                          const nextTime = e.target.value;
                          setReminders(prev => prev.map(r => r.dhikrId === reminder.dhikrId ? { ...r, time: nextTime } : r));
                          
                          if (reminder.enabled) {
                            setAlarmLogs(prev => [
                              `[${new Date().toLocaleTimeString()}] [AlarmManager] Updated schedule for '${reminder.dhikrId}' to ${nextTime} RTC_WAKEUP`,
                              ...prev
                            ]);
                          }
                        }}
                        className="bg-emerald-900/60 border border-emerald-700/40 text-emerald-100 text-[10px] rounded px-1.5 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Test Alarm Dispatcher */}
                    <button
                      onClick={() => {
                        postSimNotification(
                          "Spiritual Consistency Alert",
                          `It's time for your daily session: ${reminder.dhikrName}. Keep up your daily streak!`,
                          "reminder"
                        );
                        if (preset) {
                          setActiveDhikr(preset);
                          setCurrentCount(0);
                        }
                      }}
                      className="text-[9px] font-bold px-2 py-1 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-300 rounded border border-emerald-700/40 cursor-pointer transition-all flex items-center gap-1"
                      title="Simulates AlarmManager Intent Dispatch"
                    >
                      <span>Simulate Trigger</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AlarmManager intent log output */}
          <div className="bg-emerald-950/80 border border-emerald-800/40 rounded-lg p-3 flex flex-col justify-between font-sans">
            <div className="text-[9px] font-mono text-emerald-400/60 uppercase tracking-wide border-b border-emerald-900/40 pb-1 mb-1.5 flex justify-between items-center">
              <span>AlarmManager Intent Logger</span>
              <button 
                onClick={() => setAlarmLogs([])}
                className="text-[8px] text-emerald-500 hover:text-emerald-300 underline font-mono cursor-pointer"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin text-[9px] font-mono text-emerald-200/90 space-y-1.5 min-h-[90px] max-h-[130px] text-left">
              {alarmLogs.length === 0 ? (
                <div className="text-emerald-500/40 italic">Waiting for AlarmManager events...</div>
              ) : (
                alarmLogs.map((log, idx) => (
                  <div key={idx} className="leading-snug border-b border-emerald-900/10 pb-0.5 last:border-0">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COMPLIANCE CHECKLIST OF STANDARDS */}
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 flex flex-col gap-3 backdrop-blur-md">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Check size={14} />
            Android Ethical & Quality Compliance Checklist
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-emerald-200/80">
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 text-[10px] text-emerald-400 font-bold mt-0.5">✔</span>
              <div>
                <strong className="text-white block font-medium">Gapless Loop Precision</strong>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">Utilizes ExoPlayer `REPEAT_MODE_ONE` to cycle the audio item instantly with zero buffering latency at the seam.</p>
              </div>
            </li>
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 text-[10px] text-emerald-400 font-bold mt-0.5">✔</span>
              <div>
                <strong className="text-white block font-medium">Sacred Media Audio Focus</strong>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">Automatically suspends recitation during incoming cell calls or Quran broadcasts to respect user priorities.</p>
              </div>
            </li>
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 text-[10px] text-emerald-400 font-bold mt-0.5">✔</span>
              <div>
                <strong className="text-white block font-medium">Instant Emergency Squelch</strong>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">One-tap critical stop instantly shuts down all ambient filters, releases sound streams and releases hardware slots.</p>
              </div>
            </li>
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 text-[10px] text-emerald-400 font-bold mt-0.5">✔</span>
              <div>
                <strong className="text-white block font-medium">TalkBack Labeling & Scale</strong>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">All interactive targets declare clear accessibility content descriptions for blind dhikr practitioners.</p>
              </div>
            </li>
          </ul>
        </div>

      </div>

    </div>
  );
}
