import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetTrek, 
  useListJoinRequests, 
  useCreateJoinRequest,
  useGetMyProfile,
  getGetTrekQueryKey,
  getListJoinRequestsQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Users, DollarSign, Loader2, ArrowLeft, Clock, Mountain, Info, Cloud, Wind, Droplets, Thermometer, FileText, ShieldCheck, Star, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PermitBuyModal } from "@/components/permit-buy-modal";
import { StarRating, StarDisplay } from "@/components/star-rating";

export default function TrekDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { user, isAuthenticated, login } = useAuth();
  const { data: profile } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });

  const { data: trek, isLoading: isTrekLoading } = useGetTrek(id, {
    query: { enabled: !!id, queryKey: getGetTrekQueryKey(id) }
  });

  const { data: joinRequests } = useListJoinRequests(id, {
    query: { enabled: !!id, queryKey: getListJoinRequestsQueryKey(id) }
  });

  const createJoinRequest = useCreateJoinRequest();

  const [message, setMessage] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Weather state
  const [weather, setWeather] = useState<{
    temperature: number;
    condition: string;
    windSpeed: number;
    humidity: number;
    icon: string;
    updatedAt: string;
    monsoonWarning: boolean;
    monsoonMessage: string | null;
    snowAlert: boolean;
    seasonStatus: string;
    trailStatus: "open" | "caution";
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    if (!trek?.destination) return;
    setWeatherLoading(true);
    const altParam = (trek as any)?.maxAltitudeMeters ? `&altitude=${(trek as any).maxAltitudeMeters}` : "";
    fetch(`/api/weather?destination=${encodeURIComponent(trek.destination)}${altParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setWeather(data); })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  }, [trek?.destination]);

  // Permits state
  const [permits, setPermits] = useState<Array<{ id: string; permitName: string; priceNPR: number; priceUSD: number; issuingAuthority: string; description: string | null; documentUrl: string | null; required: boolean }>>([]);
  const [buyPermit, setBuyPermit] = useState<typeof permits[number] | null>(null);

  useEffect(() => {
    if (!trek?.destination) return;
    fetch(`/api/permits?destination=${encodeURIComponent(trek.destination)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPermits(data))
      .catch(() => {});
  }, [trek?.destination]);

  const isAgency = profile?.role === "agency";
  const isTrekker = profile?.role === "trekker";
  
  const myJoinRequest = joinRequests?.find(req => req.trekkerId === profile?.id);
  const hasJoined = !!myJoinRequest;

  const handleJoin = () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    
    if (!isTrekker) {
      toast({
        title: "Not a trekker",
        description: "Only trekkers can join treks.",
        variant: "destructive"
      });
      return;
    }

    setIsJoining(true);
    createJoinRequest.mutate(
      { trekId: id, data: { message } },
      {
        onSuccess: () => {
          toast({
            title: "Request Sent!",
            description: "Your request to join this trek has been sent to the agency.",
          });
          queryClient.invalidateQueries({ queryKey: getListJoinRequestsQueryKey(id) });
          setIsJoining(false);
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message ?? "Failed to send request.",
            variant: "destructive"
          });
          setIsJoining(false);
        }
      }
    );
  };

  if (isTrekLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trek) {
    return <div className="container py-20 text-center">Trek not found.</div>;
  }

  return (
    <div>
      {/* Hero Header */}
      <div className="relative h-[40vh] min-h-[300px] w-full">
        <img 
          src={trek.imageUrl || `/images/trek-${(parseInt(trek.id, 36) % 2) + 1}.png`}
          alt={trek.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex flex-col justify-end container mx-auto px-4 pb-8 text-white">
          <Link href="/treks" className="text-white/80 hover:text-white flex items-center mb-6 w-fit">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to treks
          </Link>
          <div className="flex items-center gap-2 text-primary-foreground/90 font-semibold tracking-wider uppercase text-sm mb-3">
            <MapPin className="w-4 h-4" /> {trek.destination}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{trek.title}</h1>
          <div className="flex flex-wrap gap-4 text-white/90">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4"/> {trek.duration} Days</span>
            <span className="flex items-center gap-1.5"><Mountain className="w-4 h-4"/> {trek.difficultyLevel}</span>
            <span className="flex items-center gap-1.5 text-primary-foreground font-semibold"><DollarSign className="w-4 h-4"/> {trek.price} / person</span>
          </div>
        </div>
      </div>

      {/* Monsoon Warning Banner */}
      {weather?.monsoonWarning && (
        <div className="bg-orange-500 text-white px-4 py-3">
          <div className="container mx-auto flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{weather.monsoonMessage}</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-10">
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">About This Trek</h2>
              <div className="prose max-w-none text-muted-foreground whitespace-pre-wrap">
                {trek.description}
              </div>
            </section>

            {/* Weather Widget */}
            {(weather || weatherLoading) && (
              <section className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 rounded-xl p-6 border border-sky-200 dark:border-sky-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2 text-sky-800 dark:text-sky-300">
                    <Cloud className="w-5 h-5" /> Weather at Trek Destination
                  </h3>
                  {weather && (
                    <div className="flex items-center gap-2">
                      {/* Trail Status */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        weather.trailStatus === "open"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      }`}>
                        {weather.trailStatus === "open" ? "Trail: Open" : "Trail: Use Caution"}
                      </span>
                      {/* Snow Alert */}
                      {weather.snowAlert && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          ❄️ Snow Alert
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {weatherLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading weather data…
                  </div>
                ) : weather ? (
                  <div className="space-y-4">
                    {/* Season Status Badge */}
                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                      weather.seasonStatus.includes("Peak") ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                      weather.seasonStatus.includes("Monsoon") ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" :
                      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}>
                      {weather.seasonStatus.includes("Peak") ? "🌸" : weather.seasonStatus.includes("Monsoon") ? "🌧️" : "❄️"}
                      {weather.seasonStatus}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="text-2xl font-bold">{weather.temperature}°C</p>
                          <p className="text-xs text-muted-foreground">Temperature</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                          alt={weather.condition}
                          className="w-10 h-10"
                        />
                        <div>
                          <p className="font-semibold">{weather.condition}</p>
                          <p className="text-xs text-muted-foreground">Condition</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wind className="w-5 h-5 text-teal-500" />
                        <div>
                          <p className="font-semibold">{weather.windSpeed} m/s</p>
                          <p className="text-xs text-muted-foreground">Wind Speed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-semibold">{weather.humidity}%</p>
                          <p className="text-xs text-muted-foreground">Humidity</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Last updated: {new Date(weather.updatedAt).toLocaleString()} · Data from OpenWeatherMap
                    </p>
                  </div>
                ) : null}
              </section>
            )}

            <section className="bg-muted/50 rounded-xl p-6 border border-border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" /> Key Information
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                  <p className="font-medium">{new Date(trek.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <p className="font-medium capitalize">{trek.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Group Size</p>
                  <p className="font-medium">{trek.currentParticipants} / {trek.maxGroupSize}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Agency</p>
                  <p className="font-medium">{trek.agencyName}</p>
                </div>
              </div>
            </section>

            {/* Reviews Section */}
            <ReviewsSection trekId={id} />
          </div>

          {/* Sidebar */}
          <div>
            <Card className="sticky top-24 border-border shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle>Join this Expedition</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <span className="text-muted-foreground">Price per person</span>
                  <span className="text-2xl font-bold">${trek.price}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Available Spots</span>
                    <span className="font-medium">{trek.maxGroupSize - trek.currentParticipants}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${(trek.currentParticipants / trek.maxGroupSize) * 100}%` }}
                    />
                  </div>
                </div>

                {!isAuthenticated ? (
                  <Button className="w-full" size="lg" onClick={login}>Log in to Join</Button>
                ) : isAgency ? (
                  <div className="bg-muted p-4 rounded text-center text-sm text-muted-foreground">
                    Agencies cannot join treks.
                  </div>
                ) : hasJoined ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded border text-center font-medium ${
                      myJoinRequest?.status === 'accepted' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30' :
                      myJoinRequest?.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30' :
                      'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30'
                    }`}>
                      Request Status: <span className="capitalize">{myJoinRequest?.status}</span>
                    </div>
                    {myJoinRequest?.status === 'accepted' && (
                      <Button className="w-full" size="lg" asChild>
                        <Link href="/dashboard">Proceed to Booking</Link>
                      </Button>
                    )}
                  </div>
                ) : trek.status !== "active" ? (
                  <Button className="w-full" size="lg" disabled>Trek not active</Button>
                ) : trek.currentParticipants >= trek.maxGroupSize ? (
                  <Button className="w-full" size="lg" disabled>Trek is Full</Button>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Message to Agency (Optional)</label>
                      <Textarea 
                        placeholder="Tell them about your experience level..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg" 
                      onClick={handleJoin}
                      disabled={isJoining}
                    >
                      {isJoining && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Request to Join
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      You won't be charged yet. The agency must approve your request first.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews section component (loaded inline to avoid circular imports)
// ---------------------------------------------------------------------------
type ReviewItem = {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewerUsername: string;
  reviewerProfileImage: string | null;
  createdAt: string;
};

function ReviewsSection({ trekId }: { trekId: string }) {
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const { toast } = useToast();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/treks/${trekId}/reviews`)
      .then((r) => r.json())
      .then(setReviews)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trekId]);

  const handleSubmit = async () => {
    if (rating === 0 || !title.trim() || !body.trim()) {
      toast({ title: "Validation", description: "Rating, title, and body are all required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/treks/${trekId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error ?? "Failed to submit review.", variant: "destructive" });
        return;
      }
      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
      setShowForm(false);
      setRating(0);
      setTitle("");
      setBody("");
      toast({ title: "Review submitted!", description: "Thank you for your feedback." });
    } finally {
      setSubmitting(false);
    }
  };

  const isTrekker = profile?.role === "trekker";

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif font-bold">Reviews ({reviews.length})</h2>
        {isTrekker && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Star className="w-4 h-4 mr-1.5" /> Write a Review
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Your Rating</p>
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                placeholder="Summarize your experience"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Review</label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-md text-sm resize-none"
                placeholder="Share details about your trek experience..."
                rows={4}
                maxLength={1000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">{body.length}/1000</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || rating === 0 || !title.trim() || !body.trim()}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6">No reviews yet. Be the first to share your experience!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <StarRating value={r.rating} size="sm" readonly />
                    <h4 className="font-semibold text-sm mt-1">{r.title}</h4>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">{r.body}</p>
                <p className="text-xs font-medium text-muted-foreground">{r.reviewerUsername}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
