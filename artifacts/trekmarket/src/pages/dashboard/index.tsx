import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetAgencyDashboard, 
  useGetTrekkerDashboard, 
  useGetMyProfile,
  useCreateTrek,
  useUpdateJoinRequest,
  useCreateCustomRequest,
  useCreateBooking,
  getGetAgencyDashboardQueryKey,
  getGetTrekkerDashboardQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Calendar, CheckCircle2, XCircle, Clock, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });

  if (isProfileLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="text-center py-20">Please log in.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground capitalize">Welcome back, {profile.firstName || profile.email} ({profile.role})</p>
      </div>
      {profile.role === "agency" ? <AgencyDashboardView /> : <TrekkerDashboardView />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted") return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Accepted
    </Badge>
  );
  if (status === "rejected") return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 gap-1">
      <XCircle className="w-3 h-3" /> Declined
    </Badge>
  );
  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 gap-1">
      <Clock className="w-3 h-3" /> Pending
    </Badge>
  );
}

function AgencyDashboardView() {
  const { data: dashboard, isLoading } = useGetAgencyDashboard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateJoinReq = useUpdateJoinRequest();
  const createTrek = useCreateTrek();

  const [isCreatingTrek, setIsCreatingTrek] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newTrek, setNewTrek] = useState({
    title: "", destination: "", duration: "", price: "", maxGroupSize: "",
    description: "", difficultyLevel: "moderate", startDate: ""
  });

  const handleUpdateReq = (id: string, status: "accepted" | "rejected") => {
    setUpdatingId(id);
    updateJoinReq.mutate({ requestId: id, data: { status } }, {
      onSuccess: () => {
        toast({ title: status === "accepted" ? "Request approved!" : "Request declined" });
        queryClient.invalidateQueries({ queryKey: getGetAgencyDashboardQueryKey() });
        setUpdatingId(null);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message ?? "Failed to update request.", variant: "destructive" });
        setUpdatingId(null);
      },
    });
  };

  const handleCreateTrek = () => {
    if (!newTrek.title || !newTrek.destination || !newTrek.price || !newTrek.startDate) return;
    setIsCreatingTrek(true);
    createTrek.mutate({
      data: {
        title: newTrek.title,
        destination: newTrek.destination,
        duration: Number(newTrek.duration) || 1,
        price: Number(newTrek.price) || 0,
        maxGroupSize: Number(newTrek.maxGroupSize) || 10,
        description: newTrek.description,
        difficultyLevel: newTrek.difficultyLevel as "easy" | "moderate" | "hard" | "extreme",
        startDate: newTrek.startDate
      }
    }, {
      onSuccess: () => {
        toast({ title: "Trek created successfully!" });
        setNewTrek({ title: "", destination: "", duration: "", price: "", maxGroupSize: "", description: "", difficultyLevel: "moderate", startDate: "" });
        queryClient.invalidateQueries({ queryKey: getGetAgencyDashboardQueryKey() });
        setIsCreatingTrek(false);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message ?? "Failed to create trek.", variant: "destructive" });
        setIsCreatingTrek(false);
      }
    });
  };

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto" />;

  const pending = dashboard?.pendingJoinRequests ?? [];
  // allJoinRequests includes pending + history; fall back to empty if API is old
  const allRequests = (dashboard as any)?.allJoinRequests ?? pending;
  const history = allRequests.filter((r: any) => r.status !== "pending");
  const acceptedCount = allRequests.filter((r: any) => r.status === "accepted").length;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Earnings</p>
              <p className="text-2xl font-bold">${(dashboard?.totalEarnings ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-full text-secondary"><Calendar className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Bookings</p>
              <p className="text-2xl font-bold">{dashboard?.totalBookings ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full text-green-700"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Accepted Trekkers</p>
              <p className="text-2xl font-bold">{acceptedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="requests">
            Pending
            {pending.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-3.5 h-3.5 mr-1.5" />
            History
            {history.length > 0 && (
              <span className="ml-2 bg-muted-foreground/20 text-muted-foreground text-xs rounded-full px-1.5 py-0.5 leading-none">
                {history.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="treks">My Treks ({dashboard?.myTreks.length ?? 0})</TabsTrigger>
          <TabsTrigger value="create">+ Create Trek</TabsTrigger>
        </TabsList>

        {/* Pending requests — with Approve / Decline */}
        <TabsContent value="requests" className="space-y-4">
          {pending.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-xl border border-border">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No pending join requests</p>
              <p className="text-sm text-muted-foreground/70 mt-1">New trekker requests will appear here</p>
            </div>
          ) : (
            pending.map((req: any) => (
              <Card key={req.id} className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold truncate">{req.trek?.title}</h4>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{req.trekkerName}</span>
                        {req.trekkerEmail && <span className="text-muted-foreground"> · {req.trekkerEmail}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trek starts: {req.trek?.startDate ? new Date(req.trek.startDate).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
                        {" · "}Requested {new Date(req.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </p>
                      {req.message && (
                        <p className="text-sm bg-background border border-border mt-3 p-3 rounded-lg italic text-muted-foreground">
                          "{req.message}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 items-start">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleUpdateReq(req.id, "rejected")}
                        disabled={updatingId === req.id}
                      >
                        {updatingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span className="ml-1.5">Decline</span>
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleUpdateReq(req.id, "accepted")}
                        disabled={updatingId === req.id}
                      >
                        {updatingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span className="ml-1.5">Approve</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* History — accepted + rejected, read-only */}
        <TabsContent value="history" className="space-y-4">
          {history.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-xl border border-border">
              <History className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No request history yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Approved and declined requests will appear here</p>
            </div>
          ) : (
            history.map((req: any) => (
              <Card key={req.id} className={req.status === "accepted"
                ? "border-green-200 bg-green-50/20 dark:bg-green-950/10"
                : "border-red-200 bg-red-50/20 dark:bg-red-950/10"
              }>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold truncate">{req.trek?.title}</h4>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{req.trekkerName}</span>
                        {req.trekkerEmail && <span> · {req.trekkerEmail}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trek: {req.trek?.destination} · {req.trek?.duration} days · ${req.trek?.price}
                        <span className="mx-2">·</span>
                        Requested {new Date(req.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </p>
                      {req.message && (
                        <p className="text-xs text-muted-foreground/70 mt-1.5 italic">"{req.message}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                      {req.trek?.startDate && (
                        <span className="bg-muted px-2 py-1 rounded text-xs">
                          Starts {new Date(req.trek.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* My Treks */}
        <TabsContent value="treks" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {(dashboard?.myTreks ?? []).length === 0 && (
            <p className="col-span-3 text-muted-foreground p-8 text-center bg-card rounded-xl border border-border">
              No treks yet. Create your first trek in the "Create Trek" tab.
            </p>
          )}
          {(dashboard?.myTreks ?? []).map(trek => (
            <Card key={trek.id} className="overflow-hidden">
              <div className="h-32 bg-muted relative">
                <img
                  src={trek.imageUrl || `/images/trek-${(parseInt(trek.id, 36) % 2) + 1}.png`}
                  className="w-full h-full object-cover opacity-60"
                  alt=""
                />
                <div className="absolute top-2 right-2 bg-background/90 px-2 py-0.5 text-xs rounded font-semibold capitalize border border-border">
                  {trek.status}
                </div>
              </div>
              <CardContent className="p-4">
                <h4 className="font-bold mb-1 line-clamp-1">{trek.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{trek.destination} · {trek.duration} days</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{trek.currentParticipants}/{trek.maxGroupSize} trekkers</span>
                  <span className="font-semibold text-primary">${trek.price}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min((trek.currentParticipants / trek.maxGroupSize) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Create Trek */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Trek Package</CardTitle>
              <CardDescription>List a new expedition for trekkers to discover and join.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input value={newTrek.title} onChange={e => setNewTrek({...newTrek, title: e.target.value})} placeholder="e.g. Everest Base Camp 14 Days" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Destination Region</label>
                  <Input value={newTrek.destination} onChange={e => setNewTrek({...newTrek, destination: e.target.value})} placeholder="e.g. Everest Region" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price ($ per person)</label>
                  <Input type="number" value={newTrek.price} onChange={e => setNewTrek({...newTrek, price: e.target.value})} placeholder="1200" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (Days)</label>
                  <Input type="number" value={newTrek.duration} onChange={e => setNewTrek({...newTrek, duration: e.target.value})} placeholder="14" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={newTrek.startDate} onChange={e => setNewTrek({...newTrek, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Group Size</label>
                  <Input type="number" value={newTrek.maxGroupSize} onChange={e => setNewTrek({...newTrek, maxGroupSize: e.target.value})} placeholder="12" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Difficulty Level</label>
                  <Select value={newTrek.difficultyLevel} onValueChange={v => setNewTrek({...newTrek, difficultyLevel: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="extreme">Extreme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={newTrek.description} onChange={e => setNewTrek({...newTrek, description: e.target.value})} rows={4} placeholder="Describe the route, highlights, what's included..." />
                </div>
              </div>
              <Button onClick={handleCreateTrek} disabled={isCreatingTrek} className="w-full md:w-auto">
                {isCreatingTrek && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Trek Package
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrekkerDashboardView() {
  const { data: dashboard, isLoading } = useGetTrekkerDashboard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const createBooking = useCreateBooking();
  const createReq = useCreateCustomRequest();

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") === "new" ? "new" : "requests";

  const [isCreatingReq, setIsCreatingReq] = useState(false);
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [newReq, setNewReq] = useState({
    destination: "", budget: "", startDate: "", groupSize: "", notes: ""
  });

  const handleBook = (trekId: string) => {
    setIsBooking(trekId);
    createBooking.mutate({ data: { trekId } }, {
      onSuccess: (b) => {
        toast({ title: "Booking initiated!" });
        setLocation(`/bookings/${b.id}`);
      },
      onError: () => setIsBooking(null)
    });
  };

  const handleCreateReq = () => {
    if (!newReq.destination || !newReq.startDate) return;
    setIsCreatingReq(true);
    createReq.mutate({
      data: {
        destination: newReq.destination,
        budget: Number(newReq.budget) || 1000,
        startDate: newReq.startDate,
        groupSize: Number(newReq.groupSize) || 2,
        notes: newReq.notes
      }
    }, {
      onSuccess: () => {
        toast({ title: "Custom request submitted!", description: "Agencies can now view and bid on your request." });
        setNewReq({ destination: "", budget: "", startDate: "", groupSize: "", notes: "" });
        queryClient.invalidateQueries({ queryKey: getGetTrekkerDashboardQueryKey() });
        setIsCreatingReq(false);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message ?? "Failed to submit request.", variant: "destructive" });
        setIsCreatingReq(false);
      }
    });
  };

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto" />;

  const allJoinReqs = [...(dashboard?.pendingRequests ?? []), ...(dashboard?.joinedTreks ?? [])];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary"><Calendar className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Upcoming Treks</p>
              <p className="text-2xl font-bold">{dashboard?.upcomingTreks ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-full text-secondary"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Spent</p>
              <p className="text-2xl font-bold">${(dashboard?.totalSpent ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="requests">
            Join Requests
            {allJoinReqs.length > 0 && (
              <span className="ml-2 bg-muted-foreground/20 text-muted-foreground text-xs rounded-full px-1.5 py-0.5 leading-none">
                {allJoinReqs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="custom">
            Custom Requests
            {(dashboard?.customRequests ?? []).length > 0 && (
              <span className="ml-2 bg-muted-foreground/20 text-muted-foreground text-xs rounded-full px-1.5 py-0.5 leading-none">
                {(dashboard?.customRequests ?? []).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="new">+ Request Custom Trip</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          {allJoinReqs.length === 0 && (
            <div className="p-12 text-center bg-card rounded-xl border border-border">
              <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No join requests yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Browse treks and request to join one!
              </p>
            </div>
          )}
          {allJoinReqs.map(req => (
            <Card key={req.id} className={
              req.status === "accepted" ? "border-green-200 bg-green-50/20 dark:bg-green-950/10" :
              req.status === "rejected" ? "border-red-200 bg-red-50/20 dark:bg-red-950/10" :
              "border-amber-200 bg-amber-50/20 dark:bg-amber-950/10"
            }>
              <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold truncate">{req.trek?.title}</h4>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{req.trek?.destination} · {req.trek?.duration} days</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Starts {req.trek?.startDate ? new Date(req.trek.startDate).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
                  </p>
                </div>
                {req.status === "accepted" && (
                  <Button size="sm" onClick={() => handleBook(req.trekId)} disabled={isBooking === req.trekId}>
                    {isBooking === req.trekId && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Book & Pay Advance
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {(dashboard?.customRequests ?? []).length === 0 && (
            <div className="p-12 text-center bg-card rounded-xl border border-border">
              <p className="font-medium text-muted-foreground">No custom requests yet</p>
            </div>
          )}
          {(dashboard?.customRequests ?? []).map(req => (
            <Card key={req.id}>
              <CardContent className="p-5 flex justify-between items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold">Trip to {req.destination}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Budget: ${req.budget} · Group: {req.groupSize} · Status: <span className="capitalize font-medium">{req.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Starts {new Date(req.startDate).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/custom-requests/${req.id}`}>
                    View Bids ({req.bidsCount ?? 0})
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Request a Custom Trek</CardTitle>
              <CardDescription>Tell agencies what you're looking for, and they'll bid on your trip.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Destination</label>
                  <Input value={newReq.destination} onChange={e => setNewReq({...newReq, destination: e.target.value})} placeholder="e.g. Upper Mustang" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Budget ($)</label>
                  <Input type="number" value={newReq.budget} onChange={e => setNewReq({...newReq, budget: e.target.value})} placeholder="1500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={newReq.startDate} onChange={e => setNewReq({...newReq, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group Size</label>
                  <Input type="number" value={newReq.groupSize} onChange={e => setNewReq({...newReq, groupSize: e.target.value})} placeholder="2" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Additional Notes</label>
                  <Textarea value={newReq.notes} onChange={e => setNewReq({...newReq, notes: e.target.value})} rows={4} placeholder="Dietary requirements, experience level, specific places you want to visit..." />
                </div>
              </div>
              <Button onClick={handleCreateReq} disabled={isCreatingReq}>
                {isCreatingReq && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit Request
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
