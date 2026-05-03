import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetCustomRequest, 
  useListBids, 
  useCreateBid, 
  useSelectBid,
  useCreateBooking,
  useGetMyProfile,
  getGetCustomRequestQueryKey,
  getListBidsQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Calendar, Users, DollarSign, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function CustomRequestDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });

  const { data: request, isLoading: isReqLoading } = useGetCustomRequest(id, {
    query: { enabled: !!id, queryKey: getGetCustomRequestQueryKey(id) }
  });

  const { data: bids, isLoading: isBidsLoading } = useListBids(id, {
    query: { enabled: !!id, queryKey: getListBidsQueryKey(id) }
  });

  const createBid = useCreateBid();
  const selectBid = useSelectBid();
  const createBooking = useCreateBooking();

  const [proposedPrice, setProposedPrice] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSelecting, setIsSelecting] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  const isAgency = profile?.role === "agency";
  const isOwner = profile?.id === request?.trekkerId;
  const myBid = bids?.find(b => b.agencyId === profile?.id);

  const handleBidSubmit = () => {
    if (!proposedPrice || !planDescription) {
      toast({ title: "Validation Error", description: "Price and plan description are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    createBid.mutate(
      { id, data: { proposedPrice: Number(proposedPrice), planDescription, message } },
      {
        onSuccess: () => {
          toast({ title: "Bid Submitted", description: "Your bid has been sent to the trekker." });
          queryClient.invalidateQueries({ queryKey: getListBidsQueryKey(id) });
          setIsSubmitting(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to submit bid.", variant: "destructive" });
          setIsSubmitting(false);
        }
      }
    );
  };

  const handleSelectBid = (bidId: string) => {
    setIsSelecting(bidId);
    selectBid.mutate(
      { id, bidId },
      {
        onSuccess: () => {
          toast({ title: "Bid Selected", description: "You have selected an agency for your custom request." });
          queryClient.invalidateQueries({ queryKey: getGetCustomRequestQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListBidsQueryKey(id) });
          setIsSelecting(null);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to select bid.", variant: "destructive" });
          setIsSelecting(null);
        }
      }
    );
  };

  const handleProceedToBooking = () => {
    if (!request?.selectedBidId) return;
    setIsBooking(true);
    createBooking.mutate(
      { data: { bidId: request.selectedBidId } },
      {
        onSuccess: (booking) => {
          toast({ title: "Booking Created", description: "Redirecting to booking confirmation..." });
          setLocation(`/bookings/${booking.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create booking.", variant: "destructive" });
          setIsBooking(false);
        }
      }
    );
  };

  if (isReqLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!request) return <div className="text-center py-20">Request not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/custom-requests" className="text-muted-foreground hover:text-primary flex items-center mb-6 w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to requests
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="border-b border-border pb-6">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-primary/10 text-primary px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider">
                  Custom Request
                </div>
                <div className="text-sm font-medium px-3 py-1 bg-muted rounded capitalize">
                  {request.status}
                </div>
              </div>
              <CardTitle className="text-3xl font-serif">Trip to {request.destination}</CardTitle>
              <p className="text-muted-foreground mt-2">Requested by {request.trekkerName}</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                  <p className="font-medium flex items-center gap-2"><Calendar className="w-4 h-4"/> {new Date(request.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Group Size</p>
                  <p className="font-medium flex items-center gap-2"><Users className="w-4 h-4"/> {request.groupSize}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Budget</p>
                  <p className="font-medium flex items-center gap-2"><DollarSign className="w-4 h-4"/> {request.budget}</p>
                </div>
              </div>
              
              {request.notes && (
                <div className="bg-muted/50 p-4 rounded-xl border border-border">
                  <h4 className="font-semibold mb-2">Additional Notes</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm">{request.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <h3 className="text-2xl font-serif font-bold mb-6">Agency Bids ({bids?.length || 0})</h3>
            
            {isBidsLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : bids?.length === 0 ? (
              <p className="text-muted-foreground">No bids received yet.</p>
            ) : (
              <div className="space-y-4">
                {bids?.map(bid => (
                  <Card key={bid.id} className={`border-2 ${bid.status === 'selected' ? 'border-primary' : 'border-border'}`}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-lg">{bid.agencyName}</h4>
                          <p className="text-sm text-muted-foreground">Proposed Price: ${bid.proposedPrice}</p>
                        </div>
                        {bid.status === 'selected' && (
                          <div className="flex items-center text-primary font-medium gap-1 text-sm bg-primary/10 px-3 py-1 rounded-full">
                            <CheckCircle2 className="w-4 h-4" /> Selected
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">
                        {bid.planDescription}
                      </div>
                      
                      {isOwner && request.status === 'open' && bid.status === 'pending' && (
                        <div className="flex justify-end pt-4 border-t border-border">
                          <Button 
                            onClick={() => handleSelectBid(bid.id)}
                            disabled={isSelecting === bid.id}
                          >
                            {isSelecting === bid.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Select this Agency
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          {isOwner && request.status === 'closed' && request.selectedBidId && (
             <Card className="sticky top-24 border-primary shadow-md">
               <CardHeader className="bg-primary/5 border-b border-border">
                 <CardTitle className="text-primary flex items-center gap-2">
                   <CheckCircle2 className="w-5 h-5" /> Ready to Book
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                 <p className="text-sm text-muted-foreground mb-6">You have selected an agency for this trip. The next step is to secure your booking with an advance payment.</p>
                 <Button className="w-full" size="lg" onClick={handleProceedToBooking} disabled={isBooking}>
                    {isBooking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Proceed to Booking
                 </Button>
               </CardContent>
             </Card>
          )}

          {isAgency && request.status === 'open' && !myBid && (
            <Card className="sticky top-24 shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle>Submit a Bid</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Proposed Price ($)</label>
                  <Input 
                    type="number" 
                    placeholder="Total price for the group"
                    value={proposedPrice}
                    onChange={e => setProposedPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Description</label>
                  <Textarea 
                    placeholder="Outline the itinerary, inclusions, and why they should choose you..."
                    rows={5}
                    value={planDescription}
                    onChange={e => setPlanDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message (Optional)</label>
                  <Textarea 
                    placeholder="Any quick message..."
                    rows={2}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>
                <Button className="w-full" size="lg" onClick={handleBidSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Proposal
                </Button>
              </CardContent>
            </Card>
          )}

          {isAgency && myBid && (
            <Card className="sticky top-24 shadow-md bg-muted/50">
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Proposal Submitted</h3>
                <p className="text-sm text-muted-foreground">You offered ${myBid.proposedPrice}. We'll notify you if the trekker selects your agency.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}