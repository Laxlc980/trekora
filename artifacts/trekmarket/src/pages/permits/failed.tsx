import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PermitFailedPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-lg text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 mb-6">
        <XCircle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-serif font-bold mb-3">Payment Failed</h1>
      <p className="text-muted-foreground mb-8">
        Your permit payment could not be completed. No charges were made. Please try again or choose a different payment method.
      </p>
      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/treks">Browse Treks</Link>
        </Button>
      </div>
    </div>
  );
}
