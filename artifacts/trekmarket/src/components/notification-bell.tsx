import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@workspace/replit-auth-web";

const NOTIF_ICONS: Record<string, string> = {
  join_accepted: "✅",
  join_rejected: "❌",
  bid_received: "💰",
  bid_selected: "🎉",
};

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const SOUND_PREF_KEY = "trekora_notif_sound";

type NotifItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Subtle chime using the Web Audio API — no external file needed.
// Plays two sine tones in sequence (C5 → E5) for ~300ms total.
// ---------------------------------------------------------------------------
function playChime(audioCtx: AudioContext) {
  const notes = [523.25, 659.25]; // C5, E5
  let startTime = audioCtx.currentTime;

  notes.forEach((freq) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

    osc.start(startTime);
    osc.stop(startTime + 0.15);

    startTime += 0.15;
  });
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Track the IDs we've already seen so we can detect new arrivals on poll
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Whether the user has interacted with the page (required for AudioContext)
  const hasInteractedRef = useRef(false);
  // Lazily created AudioContext — created on first interaction
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound preference — read from localStorage, default on
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SOUND_PREF_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(SOUND_PREF_KEY, String(next)); } catch {}
      return next;
    });
  };

  // Mark user interaction so AudioContext is allowed
  useEffect(() => {
    const mark = () => { hasInteractedRef.current = true; };
    window.addEventListener("click", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("click", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  const maybePlayChime = useCallback(() => {
    if (!soundEnabled || !hasInteractedRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().then(() => playChime(ctx)).catch(() => {});
      } else {
        playChime(ctx);
      }
    } catch {
      // AudioContext not supported — silently ignore
    }
  }, [soundEnabled]);

  const fetchNotifications = useCallback(async (isBackground = false) => {
    if (!isAuthenticated) return;
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
      if (!res.ok) return;
      const data: { data?: NotifItem[]; pagination?: unknown } | NotifItem[] = await res.json();
      // Handle both paginated ({ data: [...] }) and legacy (array) shapes
      const items: NotifItem[] = Array.isArray(data) ? data : (data as any).data ?? [];

      if (isBackground && seenIdsRef.current.size > 0) {
        const newItems = items.filter((n) => !seenIdsRef.current.has(n.id));
        if (newItems.length > 0) {
          maybePlayChime();
        }
      }

      items.forEach((n) => seenIdsRef.current.add(n.id));
      setNotifications(items);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [isAuthenticated, maybePlayChime]);

  // Initial load + background polling
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications(false);
    const timer = setInterval(() => fetchNotifications(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated, fetchNotifications]);

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) fetchNotifications(false);
  };

  if (!isAuthenticated) return null;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[520px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              {soundEnabled
                ? <Bell className="w-3.5 h-3.5" />
                : <BellOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                  n.read ? "opacity-60" : "bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base mt-0.5">{NOTIF_ICONS[n.type] ?? "🔔"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
