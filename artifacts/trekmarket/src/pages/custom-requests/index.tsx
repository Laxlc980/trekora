import { Link } from "wouter";
import { useListCustomRequests, useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Users, DollarSign, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

export default function CustomRequestsList() {
  const { data: requests, isLoading } = useListCustomRequests();
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });

  const isTrekker = profile?.role === "trekker";

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold mb-2">Custom Requests</h1>
          <p className="text-muted-foreground">Trekkers looking for bespoke expeditions.</p>
        </div>
        {isTrekker && (
          <Button asChild size="lg">
            <Link href="/dashboard?tab=new">Request Custom Trip</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : requests?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No custom requests open</h3>
          <p className="text-muted-foreground">Check back later for new requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests?.map(req => (
            <Card key={req.id} className="overflow-hidden hover-elevate transition-all border-border flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider">
                    {req.destination}
                  </div>
                  <div className="text-sm font-medium flex items-center bg-muted px-2 py-1 rounded">
                    <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                    {req.budget}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold mb-1">Custom Trek to {req.destination}</h3>
                <p className="text-sm text-muted-foreground mb-4">Requested by {req.trekkerName}</p>
                
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(req.startDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {req.groupSize} People
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-semibold">{req.bidsCount || 0}</span> bids
                  </div>
                  <Button variant="ghost" asChild className="group pr-0">
                    <Link href={`/custom-requests/${req.id}`}>
                      View details <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}