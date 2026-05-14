import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";

export function SosButton() {
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const [hasActive, setHasActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Check if trekker has an active booking
  useEffect(() => {
    if (!isAuthenticated || profile?.role !== "trekker") return;
    fetch("/api/sos/active", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setHasActive(data.hasActiveBooking ?? false))
      .catch(() => {});
  }, [isAuthenticated, profile?.role]);

  // Countdown timer when modal opens
  useEffect(() => {
    if (!showModal) { setCountdown(5); return; }
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showModal, countdown]);

  const handleTrigger = useCallback(async () => {
    setSending(true);
    try {
      // Try to get GPS coordinates
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // GPS not available — proceed without coordinates
      }

      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ latitude, longitude }),
      });

      if (res.ok) {
        setSent(true);
      }
    } finally {
      setSending(false);
    }
  }, []);

  // Don't render if not a trekker with an active booking
  if (!hasActive) return null;

  // Full-screen success state
  if (sent) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-serif font-bold mb-4">Alert Sent</h1>
        <p className="text-lg text-muted-foreground max-w-md mb-8">
          Your emergency contacts and agency have been notified. Stay calm and stay where you are if possible.
        </p>
        <Button variant="outline" onClick={() => { setSent(false); setShowModal(false); }}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5 font-bold animate-pulse"
        onClick={() => setShowModal(true)}
        aria-label="SOS Emergency Alert"
      >
        <AlertTriangle className="w-4 h-4" />
        SOS
      </Button>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open && !sending) setShowModal(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              Emergency SOS Alert
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">
                This will immediately alert all your emergency contacts and your agency.
                Only use in a genuine emergency.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              When you confirm, we will:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Send SMS to all your emergency contacts</li>
              <li>Email your emergency contacts with your location</li>
              <li>Notify your trek agency immediately</li>
              <li>Share your GPS coordinates if available</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setShowModal(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTrigger}
              disabled={countdown > 0 || sending}
              className="min-w-[140px]"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : countdown > 0 ? (
                `Confirm (${countdown}s)`
              ) : (
                "Confirm SOS"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
