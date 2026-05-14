import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile, useSetUserRole } from "@workspace/api-client-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Mountain, Loader2, Compass, Tent, CheckCircle2, XCircle, AtSign } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { SosButton } from "@/components/sos-button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

function useUsernameAvailability(username: string) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  useEffect(() => {
    if (!username) { setStatus("idle"); return; }

    if (username.length < 3 || username.length > 20 || !USERNAME_REGEX.test(username)) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  return status;
}

export function RoleSelection() {
  const { mutate: setRole, isPending } = useSetUserRole();
  const queryClient = useQueryClient();
  const [role, setLocalRole] = useState<"trekker" | "agency" | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [username, setUsername] = useState("");
  const availabilityStatus = useUsernameAvailability(username);

  const canSubmit =
    !!role &&
    availabilityStatus === "available" &&
    !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setRole(
      { data: { role, username, agencyName: role === "agency" ? agencyName : undefined } },
      {
        onSuccess: (profile) => {
          queryClient.setQueryData(getGetMyProfileQueryKey(), profile);
        },
      }
    );
  };

  const usernameHint = () => {
    if (!username) return null;
    if (availabilityStatus === "invalid") {
      if (username.length < 3) return { ok: false, msg: "At least 3 characters" };
      if (username.length > 20) return { ok: false, msg: "At most 20 characters" };
      return { ok: false, msg: "Letters, numbers, and underscores only" };
    }
    if (availabilityStatus === "checking") return { ok: null, msg: "Checking…" };
    if (availabilityStatus === "taken") return { ok: false, msg: "Username is already taken" };
    if (availabilityStatus === "available") return { ok: true, msg: "@" + username + " is available" };
    return null;
  };

  const hint = usernameHint();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <Mountain className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-4xl font-serif font-bold text-foreground">Welcome to Trekora</h1>
          <p className="text-muted-foreground text-lg">Choose how you want to use the platform.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div
            className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover-elevate ${
              role === "trekker" ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
            onClick={() => setLocalRole("trekker")}
            data-testid="button-role-trekker"
          >
            <Compass className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-xl font-bold mb-2">I'm a Trekker</h2>
            <p className="text-muted-foreground">Find adventures, join groups, and book custom treks.</p>
          </div>

          <div
            className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover-elevate ${
              role === "agency" ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
            onClick={() => setLocalRole("agency")}
            data-testid="button-role-agency"
          >
            <Tent className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-xl font-bold mb-2">I'm an Agency / Guide</h2>
            <p className="text-muted-foreground">List packages, manage bookings, and bid on custom requests.</p>
          </div>
        </div>

        {/* Username field — always shown once a role is selected */}
        {role && (
          <div className="space-y-4 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5" />
                Choose a username
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  placeholder="e.g. summit_seeker"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={20}
                  data-testid="input-username"
                  className={
                    hint?.ok === true ? "border-green-500 pr-9" :
                    hint?.ok === false ? "border-destructive pr-9" : "pr-9"
                  }
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {availabilityStatus === "checking" && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {availabilityStatus === "available" && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {(availabilityStatus === "taken" || availabilityStatus === "invalid") && username && (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
              {hint && (
                <p className={`text-xs ${hint.ok === true ? "text-green-600" : hint.ok === false ? "text-destructive" : "text-muted-foreground"}`}>
                  {hint.msg}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                3–20 characters. Letters, numbers, and underscores only. Cannot be changed later.
              </p>
            </div>

            {role === "agency" && (
              <div className="space-y-2">
                <Label htmlFor="agencyName">Agency Name (Optional)</Label>
                <Input
                  id="agencyName"
                  placeholder="e.g. Himalayan Explorers"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  data-testid="input-agency-name"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            className="w-full max-w-xs"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="button-submit-role"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });
  const [location] = useLocation();

  if (isAuthenticated && isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated && profile && !profile.role) {
    return <RoleSelection />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <Mountain className="w-6 h-6 text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight">Trekora</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/treks"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.startsWith("/treks") ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="link-nav-treks"
            >
              Browse Treks
            </Link>
            <Link
              href="/custom-requests"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.startsWith("/custom-requests") ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="link-nav-custom"
            >
              Custom Requests
            </Link>
            <Link
              href="/community"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.startsWith("/community") ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="link-nav-community"
            >
              Community
            </Link>
            <Link
              href="/gear"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.startsWith("/gear") ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="link-nav-gear"
            >
              Gear
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <SosButton />
            <NotificationBell />
            {!isAuthenticated ? (
              <Button onClick={login} data-testid="button-login">
                Log In
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="button-user-menu">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={profile?.profileImageUrl || ""} alt={profile?.firstName || "User"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {profile?.firstName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {profile?.username && (
                        <p className="font-medium">@{profile.username}</p>
                      )}
                      {profile?.firstName && (
                        <p className="text-xs text-muted-foreground">{profile.firstName} {profile.lastName}</p>
                      )}
                      <p className="text-xs font-semibold text-primary capitalize mt-1">
                        {profile?.role === "agency" ? "Agency / Guide" : "Trekker"}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer w-full" data-testid="link-menu-dashboard">
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer w-full" data-testid="link-menu-profile">
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive cursor-pointer"
                    onClick={logout}
                    data-testid="button-logout"
                  >
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-12 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Mountain className="w-6 h-6 text-primary" />
              <span className="font-serif font-bold text-xl">Trekora</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Plan. Connect. Trek. — Your smart platform to discover, plan, and book trekking experiences with guides and fellow trekkers.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Platform</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/treks" className="hover:text-primary transition-colors">Browse Treks</Link></li>
              <li><Link href="/custom-requests" className="hover:text-primary transition-colors">Custom Requests</Link></li>
              <li><Link href="/community" className="hover:text-primary transition-colors">Community</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}