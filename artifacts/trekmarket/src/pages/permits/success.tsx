import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, FileText, Loader2 } from "lucide-react";

type PermitData = {
  id: string;
  permitName: string | null;
  permitNumber: string | null;
  documentUrl: string | null;
  status: string;
};

export default function PermitSuccessPage() {
  const [permit, setPermit] = useState<PermitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setLoading(false); return; }

    fetch("/api/permits/my", { credentials: "include" })
      .then((r) => r.json())
      .then((data: PermitData[]) => {
        const found = data.find((p) => p.id === id);
        if (found) setPermit(found);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-serif font-bold mb-3">Permit Purchased!</h1>
      <p className="text-muted-foreground mb-8">Your trek permit has been secured.</p>

      {permit && (
        <Card className="mb-8 text-left">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-semibold">{permit.permitName}</span>
            </div>
            {permit.permitNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Permit Number</p>
                <p className="font-mono font-bold text-lg">{permit.permitNumber}</p>
              </div>
            )}
            {permit.documentUrl && (
              <Button variant="outline" asChild className="w-full gap-2">
                <a href={permit.documentUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" /> Download Official Form (PDF)
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/profile">View My Permits</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
