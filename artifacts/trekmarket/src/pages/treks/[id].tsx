import { useState } from "react";
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
import { MapPin, Calendar, Users, DollarSign, Loader2, ArrowLeft, Clock, Mountain, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
      { id, data: { message } },
      {
        onSuccess: () => {
          toast({
            title: "Request Sent!",
            description: "Your request to join this trek has been sent to the agency.",
          });
          queryClient.invalidateQueries({ queryKey: getListJoinRequestsQueryKey(id) });
          setIsJoining(false);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to send request.",
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