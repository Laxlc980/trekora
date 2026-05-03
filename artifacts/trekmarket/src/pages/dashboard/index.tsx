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
import { Loader2, Plus, DollarSign, Calendar, MapPin, CheckCircle2, XCircle } from "lucide-react";
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

function AgencyDashboardView() {
  const { data: dashboard, isLoading } = useGetAgencyDashboard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateJoinReq = useUpdateJoinRequest();
  const createTrek = useCreateTrek();
  
  const [isCreatingTrek, setIsCreatingTrek] = useState(false);
  const [newTrek, setNewTrek] = useState({
    title: "", destination: "", duration: "", price: "", maxGroupSize: "", description: "", difficultyLevel: "moderate", startDate: ""
  });

  const handleUpdateReq = (id: string, status: "accepted" | "rejected") => {
    updateJoinReq.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Request ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetAgencyDashboardQueryKey() });
      }
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
        difficultyLevel: newTrek.difficultyLevel as any,
        startDate: newTrek.startDate
      }
    }, {
      onSuccess: () => {
        toast({ title: "Trek Created" });
        setNewTrek({ title: "", destination: "", duration: "", price: "", maxGroupSize: "", description: "", difficultyLevel: "moderate", startDate: "" });
        queryClient.invalidateQueries({ queryKey: getGetAgencyDashboardQueryKey() });
        setIsCreatingTrek(false);
      },
      onError: () => setIsCreatingTrek(false)
    });
  };

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto" />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Total Earnings</p>
              <p className="text-3xl font-bold">${dashboard?.totalEarnings || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-secondary/10 rounded-full text-secondary">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Total Bookings</p>
              <p className="text-3xl font-bold">{dashboard?.totalBookings || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">Join Requests ({dashboard?.pendingJoinRequests.length || 0})</TabsTrigger>
          <TabsTrigger value="treks">My Treks</TabsTrigger>
          <TabsTrigger value="create">Create Trek</TabsTrigger>
        </TabsList>
        
        <TabsContent value="requests" className="space-y-4">
          {dashboard?.pendingJoinRequests.length === 0 && <p className="text-muted-foreground p-8 text-center bg-card rounded-xl border border-border">No pending join requests.</p>}
          {dashboard?.pendingJoinRequests.map(req => (
            <Card key={req.id}>
              <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="font-bold">{req.trek?.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">Trekker: {req.trekkerName} ({req.trekkerEmail})</p>
                  {req.message && <p className="text-sm bg-muted p-2 rounded">"{req.message}"</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleUpdateReq(req.id, "rejected")}>Decline</Button>
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleUpdateReq(req.id, "accepted")}>Approve</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="treks" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dashboard?.myTreks.map(trek => (
            <Card key={trek.id} className="overflow-hidden">
              <div className="h-32 bg-muted relative">
                <img src={trek.imageUrl || `/images/trek-${(parseInt(trek.id, 36) % 2) + 1}.png`} className="w-full h-full object-cover opacity-50" alt="" />
                <div className="absolute top-2 right-2 bg-background/80 px-2 py-0.5 text-xs rounded font-bold capitalize">{trek.status}</div>
              </div>
              <CardContent className="p-4">
                <h4 className="font-bold mb-1 line-clamp-1">{trek.title}</h4>
                <div className="text-sm text-muted-foreground flex justify-between">
                  <span>{trek.currentParticipants}/{trek.maxGroupSize} booked</span>
                  <span>${trek.price}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Trek Package</CardTitle>
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
                  <label className="text-sm font-medium">Price ($)</label>
                  <Input type="number" value={newTrek.price} onChange={e => setNewTrek({...newTrek, price: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (Days)</label>
                  <Input type="number" value={newTrek.duration} onChange={e => setNewTrek({...newTrek, duration: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={newTrek.startDate} onChange={e => setNewTrek({...newTrek, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Group Size</label>
                  <Input type="number" value={newTrek.maxGroupSize} onChange={e => setNewTrek({...newTrek, maxGroupSize: e.target.value})} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Difficulty Level</label>
                  <Select value={newTrek.difficultyLevel} onValueChange={v => setNewTrek({...newTrek, difficultyLevel: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
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
                  <Textarea value={newTrek.description} onChange={e => setNewTrek({...newTrek, description: e.target.value})} rows={4} />
                </div>
              </div>
              <Button onClick={handleCreateTrek} disabled={isCreatingTrek} className="w-full md:w-auto">
                {isCreatingTrek && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Trek
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
  
  const [isCreatingReq, setIsCreatingReq] = useState(false);
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [newReq, setNewReq] = useState({
    destination: "", budget: "", startDate: "", groupSize: "", notes: ""
  });

  const handleBook = (trekId: string) => {
    setIsBooking(trekId);
    createBooking.mutate({ data: { trekId } }, {
      onSuccess: (b) => {
        toast({ title: "Booking initiated" });
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
        toast({ title: "Custom Request Created" });
        setNewReq({ destination: "", budget: "", startDate: "", groupSize: "", notes: "" });
        queryClient.invalidateQueries({ queryKey: getGetTrekkerDashboardQueryKey() });
        setIsCreatingReq(false);
      },
      onError: () => setIsCreatingReq(false)
    });
  };

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto" />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Upcoming Treks</p>
              <p className="text-3xl font-bold">{dashboard?.upcomingTreks || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">Join Requests</TabsTrigger>
          <TabsTrigger value="custom">My Custom Requests</TabsTrigger>
          <TabsTrigger value="new">Request Custom Trip</TabsTrigger>
        </TabsList>
        
        <TabsContent value="requests" className="space-y-4">
          {dashboard?.joinedTreks.length === 0 && dashboard?.pendingRequests.length === 0 && (
            <p className="text-muted-foreground p-8 text-center bg-card rounded-xl border border-border">No join requests.</p>
          )}
          
          {[...(dashboard?.pendingRequests||[]), ...(dashboard?.joinedTreks||[])].map(req => (
            <Card key={req.id}>
              <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="font-bold flex items-center gap-2">
                    {req.trek?.title}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      req.status === 'accepted' ? 'bg-green-100 text-green-800' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {req.status}
                    </span>
                  </h4>
                  <p className="text-sm text-muted-foreground">Start: {req.trek?.startDate ? new Date(req.trek.startDate).toLocaleDateString() : ''}</p>
                </div>
                {req.status === 'accepted' && (
                  <Button onClick={() => handleBook(req.trekId)} disabled={isBooking === req.trekId}>
                    {isBooking === req.trekId && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Book & Pay Advance
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {dashboard?.customRequests.length === 0 && <p className="text-muted-foreground p-8 text-center bg-card">No custom requests.</p>}
          {dashboard?.customRequests.map(req => (
            <Card key={req.id}>
              <CardContent className="p-6 flex justify-between items-center">
                <div>
                  <h4 className="font-bold">Trip to {req.destination}</h4>
                  <p className="text-sm text-muted-foreground">Budget: ${req.budget} | Status: {req.status}</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/custom-requests/${req.id}`}>View Bids ({req.bidsCount||0})</Link>
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
                  <Input type="number" value={newReq.budget} onChange={e => setNewReq({...newReq, budget: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={newReq.startDate} onChange={e => setNewReq({...newReq, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group Size</label>
                  <Input type="number" value={newReq.groupSize} onChange={e => setNewReq({...newReq, groupSize: e.target.value})} />
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