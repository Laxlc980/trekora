import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MapPin, Calendar, Mountain, Star, MessageSquare, Tent, ArrowLeft } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type PublicProfile = {
  id: string;
  username: string | null;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  agencyName: string | null;
  bio: string | null;
  location: string | null;
  memberSince: string;
  // trekker fields
  completedTreks?: Array<{ bookingId: string; trekId: string | null; title: string | null; destination: string | null; duration: number | null; difficultyLevel: string | null; imageUrl: string | null; bookedAt: string }>;
  threads?: Array<{ id: string; title: string; replyCount: number; createdAt: string }>;
  // agency fields
  avgRating?: number | null;
  totalTreksListed?: number;
  activeTreks?: Array<{ id: string; title: string; destination: string; duration: number; price: number; difficultyLevel: string; maxAltitudeMeters: number | null; imageUrl: string | null; currentParticipants: number; maxGroupSize: number; startDate: string }>;
};

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { isAuthenticated } = useAuth();
  const { data: myProfile } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const { toast } = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingDm, setSendingDm] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`/api/users/profile/${encodeURIComponent(username)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProfile(data))
      .finally(() => setLoading(false));
  }, [username]);

  const handleSendDmRequest = async () => {
    if (!username) return;
    setSendingDm(true);
    try {
      const res = await fetch("/api/dm/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed to send DM request.", variant: "destructive" });
        return;
      }
      toast({ title: "DM request sent!", description: `@${username} will be notified.` });
    } finally {
      setSendingDm(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return (
    <div className="container mx-auto px-4 py-20 text-center">
      <p className="text-muted-foreground">User not found.</p>
      <Link href="/" className="text-primary hover:underline text-sm mt-2 inline-block">Go home</Link>
    </div>
  );

  const isOwnProfile = myProfile?.id === profile.id;
  const displayName = profile.role === "agency" && profile.agencyName
    ? profile.agencyName
    : `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || `@${profile.username}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>

      {/* Profile header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar className="w-20 h-20 border-2 border-border">
              <AvatarImage src={profile.profileImageUrl ?? ""} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-serif font-bold">{displayName}</h1>
                {profile.username && (
                  <span className="text-muted-foreground text-sm">@{profile.username}</span>
                )}
                <Badge variant="secondary" className="capitalize">{profile.role ?? "user"}</Badge>
              </div>
              {profile.bio && <p className="text-muted-foreground text-sm mb-2 line-clamp-3">{profile.bio}</p>}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {profile.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.location}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Member since {new Date(profile.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                {profile.role === "agency" && profile.avgRating != null && (
                  <span className="flex items-center gap-1 text-amber-500 font-medium">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />{profile.avgRating} avg rating
                  </span>
                )}
              </div>
            </div>
            {isAuthenticated && !isOwnProfile && (
              <Button variant="outline" size="sm" onClick={handleSendDmRequest} disabled={sendingDm} className="shrink-0">
                {sendingDm ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <MessageSquare className="w-4 h-4 mr-1.5" />}
                Message
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trekker content */}
      {profile.role === "trekker" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <Mountain className="w-5 h-5 text-primary" />
              Completed Treks ({profile.completedTreks?.length ?? 0})
            </h2>
            {!profile.completedTreks?.length ? (
              <p className="text-muted-foreground text-sm">No completed treks yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.completedTreks.map((t) => (
                  <Card key={t.bookingId} className="overflow-hidden">
                    {t.imageUrl && (
                      <div className="h-28 overflow-hidden">
                        <img src={t.imageUrl} alt={t.title ?? ""} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h4 className="font-semibold line-clamp-1">{t.title ?? "Custom Trip"}</h4>
                      {t.destination && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{t.destination}</p>}
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        {t.duration && <span>{t.duration} days</span>}
                        {t.difficultyLevel && <span className="capitalize">{t.difficultyLevel}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Community Threads ({profile.threads?.length ?? 0})
            </h2>
            {!profile.threads?.length ? (
              <p className="text-muted-foreground text-sm">No threads posted yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.threads.map((t) => (
                  <Link key={t.id} href={`/community/${t.id}`}>
                    <Card className="cursor-pointer hover:border-primary/40 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium line-clamp-1">{t.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <MessageSquare className="w-3.5 h-3.5" />{t.replyCount}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Agency content */}
      {profile.role === "agency" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-primary">{profile.totalTreksListed ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Treks Listed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-primary">{profile.activeTreks?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Active Treks</p>
              </CardContent>
            </Card>
            {profile.avgRating != null && (
              <Card>
                <CardContent className="p-5 text-center">
                  <p className="text-3xl font-bold text-amber-500 flex items-center justify-center gap-1">
                    <Star className="w-6 h-6 fill-amber-500" />{profile.avgRating}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Average Rating</p>
                </CardContent>
              </Card>
            )}
          </div>

          <section>
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <Tent className="w-5 h-5 text-primary" />
              Active Treks
            </h2>
            {!profile.activeTreks?.length ? (
              <p className="text-muted-foreground text-sm">No active treks at the moment.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.activeTreks.map((t) => (
                  <Link key={t.id} href={`/treks/${t.id}`}>
                    <Card className="cursor-pointer hover:border-primary/40 transition-colors overflow-hidden">
                      {t.imageUrl && (
                        <div className="h-28 overflow-hidden">
                          <img src={t.imageUrl} alt={t.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <h4 className="font-semibold line-clamp-1 mb-1">{t.title}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{t.destination}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{t.duration} days</span>
                          <span className="capitalize">{t.difficultyLevel}</span>
                          <span className="font-semibold text-primary">${t.price}</span>
                          {t.maxAltitudeMeters && <span className="flex items-center gap-0.5"><Mountain className="w-3 h-3" />{t.maxAltitudeMeters.toLocaleString()}m</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
