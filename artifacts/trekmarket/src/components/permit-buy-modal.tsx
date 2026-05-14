import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CreditCard, Wallet, Banknote, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PermitType = {
  id: string;
  permitName: string;
  priceNPR: number;
  priceUSD: number;
  issuingAuthority: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  permit: PermitType;
  bookingId?: string;
};

type PaymentOption = "khalti" | "esewa" | "stripe" | "offline";

export function PermitBuyModal({ open, onClose, permit, bookingId }: Props) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<PaymentOption | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!selected) return;
    setLoading(true);

    try {
      if (selected === "offline") {
        const res = await fetch("/api/permits/pay/offline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ permitTypeId: permit.id, bookingId }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: "Error", description: err.error ?? "Failed", variant: "destructive" });
          return;
        }
        toast({ title: "Permit reserved", description: "Present payment receipt to your agency on trek day." });
        onClose();
        return;
      }

      const endpoint = `/api/permits/pay/${selected}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permitTypeId: permit.id, bookingId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Payment initiation failed", variant: "destructive" });
        return;
      }

      // For eSewa, we need to submit a form
      if (selected === "esewa" && data.formAction && data.formData) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.formAction;
        Object.entries(data.formData).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // For Khalti and Stripe, redirect to payment URL
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      toast({ title: "Error", description: "Unexpected response from payment service", variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const options: { key: PaymentOption; label: string; sublabel: string; icon: React.ReactNode; amount: string }[] = [
    { key: "khalti", label: "Khalti", sublabel: "Nepal digital wallet", icon: <Wallet className="w-6 h-6 text-purple-600" />, amount: `NPR ${permit.priceNPR.toLocaleString()}` },
    { key: "esewa", label: "eSewa", sublabel: "Nepal mobile payment", icon: <Wallet className="w-6 h-6 text-green-600" />, amount: `NPR ${permit.priceNPR.toLocaleString()}` },
    { key: "stripe", label: "Card / International", sublabel: "Visa, Mastercard, etc.", icon: <CreditCard className="w-6 h-6 text-blue-600" />, amount: `USD $${permit.priceUSD}` },
    { key: "offline", label: "Pay Offline", sublabel: "Cash on arrival", icon: <Banknote className="w-6 h-6 text-amber-600" />, amount: `NPR ${permit.priceNPR.toLocaleString()}` },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buy Permit: {permit.permitName}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          Issued by <span className="font-medium text-foreground">{permit.issuingAuthority}</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {options.map((opt) => (
            <Card
              key={opt.key}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                selected === opt.key ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"
              }`}
              onClick={() => setSelected(opt.key)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                {opt.icon}
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.sublabel}</p>
                <p className="text-sm font-bold text-primary mt-1">{opt.amount}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {selected === "offline" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Your permit will be reserved but not issued until payment is confirmed. Present your payment receipt to the agency on trek day.</p>
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!selected || loading}
          onClick={handlePay}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {selected === "offline" ? "Reserve Permit" : "Proceed to Payment"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
