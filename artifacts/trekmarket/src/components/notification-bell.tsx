import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";

const NOTIF_ICONS: Record<string, string> = {
  join_accepted: "✅",
  join_rejected: "❌",
  bid_received: "💰",
  bid_selected: "🎉",
};

type NotifItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLoaded(false);
      fetchNotifications();
    }
  };

  if (!isAuthenticated) return null;

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
      <DropdownMenuContent align="end" className="w-80 max-h-[480px] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
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
