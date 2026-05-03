import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, User, Mail, Calendar, Users, TrendingUp, Loader2, AlertCircle } from "lucide-react";

interface AgencyProfile {
  id: string;
  agencyName: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  createdAt: string;
  treks: Array<{
    id: string;
    title: string;
    destination: string;
    duration: number;
    price: number;
    maxGroupSize: number;
    difficultyLevel: string;
    currentParticipants: number;
    imageUrl: string | null;
  }>;
}

export default function AgencyProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<AgencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchAgency = async () => {
      try {
        const res = await fetch(`/api/agencies/${id}`);
        if (!res.ok) throw new Error("Agency not found");
        setProfile(await res.json());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agency");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchAgency();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive mb-4">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">{error || "Agency not found"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/10 to-background border-b border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="flex-shrink-0">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt={profile.agencyName || "Agency"}
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                  <User className="w-16 h-16 text-primary/40" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-serif font-bold mb-2">
                {profile.agencyName || `${profile.firstName} ${profile.lastName}`}
              </h1>
              {profile.bio && <p className="text-lg text-muted-foreground mb-4">{profile.bio}</p>}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {profile.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Joined {new Date(profile.createdAt).getFullYear()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>{profile.treks.length} Trek{profile.treks.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Treks */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-serif font-bold mb-12">
            {profile.agencyName || "Agency"}'s Trek Packages
          </h2>

          {profile.treks.length === 0 ? (
            <Card className="border-border">
              <CardContent className="pt-12 pb-12 text-center">
                <p className="text-muted-foreground text-lg">No treks available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.treks.map((trek) => (
                <Card key={trek.id} className="overflow-hidden hover-elevate transition-all border-border group cursor-pointer">
                  <div className="h-48 relative overflow-hidden bg-muted">
                    {trek.imageUrl ? (
                      <img
                        src={trek.imageUrl}
                        alt={trek.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                      ${trek.price}
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider mb-3">
                      <MapPin className="w-4 h-4" />
                      {trek.destination}
                    </div>
                    <h3 className="text-lg font-serif font-bold mb-4 line-clamp-2">{trek.title}</h3>

                    <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {trek.duration} Days
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Max {trek.maxGroupSize}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <div className="text-xs font-medium px-2 py-1 bg-secondary/10 text-secondary rounded capitalize">
                        {trek.difficultyLevel}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {trek.currentParticipants} joined
                      </span>
                    </div>

                    <Button asChild className="w-full mt-4" data-testid={`button-view-trek-${trek.id}`}>
                      <a href={`/treks/${trek.id}`}>View Details</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
