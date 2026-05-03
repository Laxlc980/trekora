import { useParams, Link } from "wouter";
import { useGetBooking, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ShieldCheck, MapPin, Calendar, CreditCard } from "lucide-react";

export default function BookingConfirmation() {
  const params = useParams();
  const id = params.id as string;
  
  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) }
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!booking) return <div className="text-center py-20">Booking not found</div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6 dark:bg-green-900/30">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-serif font-bold mb-4">Booking Confirmed!</h1>
        <p className="text-xl text-muted-foreground">Your Himalayan adventure is officially secured.</p>
      </div>

      <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
        <div className="bg-primary/5 border-b border-primary/10 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Booking Reference</p>
            <p className="font-mono font-bold text-xl">{booking.paymentRef || booking.id.substring(0,8).toUpperCase()}</p>
          </div>
          <div className="bg-white dark:bg-black px-4 py-2 rounded-full border border-border shadow-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <span className="font-bold text-sm">Secure Payment</span>
          </div>
        </div>

        <CardContent className="p-8 space-y-8">
          {booking.trek && (
            <div className="flex gap-6 items-center border-b border-border pb-8">
              <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 hidden sm:block bg-muted">
                <img 
                  src={booking.trek.imageUrl || `/images/trek-1.png`} 
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold font-serif mb-2">{booking.trek.title}</h3>
                <div className="flex flex-col sm:flex-row gap-4 text-muted-foreground text-sm">
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4"/> {booking.trek.destination}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4"/> {new Date(booking.trek.startDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Payment Summary
            </h4>
            <div className="bg-muted/50 rounded-xl p-6 space-y-4">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Package Amount</span>
                <span>${booking.totalAmount}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-border pt-4">
                <span>Advance Paid (30%)</span>
                <span className="text-primary">${booking.advanceAmount}</span>
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">Balance Due on Arrival</span>
                <span className="font-medium">${booking.totalAmount - booking.advanceAmount}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2">Cancellation Policy</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {booking.cancellationPolicy || "Free cancellation up to 30 days before the start date. Advance payment is non-refundable if cancelled within 30 days of the trek."}
            </p>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 p-6 flex flex-col sm:flex-row gap-4 border-t border-border">
          <Button asChild className="w-full sm:w-auto" size="lg">
            <Link href="/dashboard">View Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto" size="lg">
            <Link href="/treks">Explore More Treks</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}