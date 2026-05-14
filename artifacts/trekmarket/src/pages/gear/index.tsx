import { useState, useEffect } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Store, ShoppingBag, MapPin } from "lucide-react";

type RentalItem = { id: string; itemName: string; description: string | null; pricePerDay: number; depositAmount: number; category: string; imageUrl: string | null; agencyName: string | null };
type SecondhandItem = { id: string; title: string; description: string | null; priceNPR: number; condition: string; category: string; imageUrl: string | null; location: string | null; sellerUsername: string | null; contactPreference: string };

const CATEGORY_COLORS: Record<string, string> = {
  footwear: "bg-amber-100 text-amber-800",
  clothing: "bg-blue-100 text-blue-800",
  camping: "bg-green-100 text-green-800",
  safety: "bg-red-100 text-red-800",
  navigation: "bg-purple-100 text-purple-800",
};

export default function GearPage() {
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [secondhand, setSecondhand] = useState<SecondhandItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/gear-rentals").then((r) => r.json()),
      fetch("/api/secondhand").then((r) => r.json()),
    ]).then(([r, s]) => { setRentals(r); setSecondhand(s); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-serif font-bold mb-2">Gear Marketplace</h1>
      <p className="text-muted-foreground mb-8">Rent or buy trekking gear from agencies and fellow trekkers.</p>

      <Tabs defaultValue="rent">
        <TabsList className="mb-6">
          <TabsTrigger value="rent" className="gap-1.5"><Store className="w-4 h-4" /> Rent Gear ({rentals.length})</TabsTrigger>
          <TabsTrigger value="secondhand" className="gap-1.5"><ShoppingBag className="w-4 h-4" /> 2nd Hand Market ({secondhand.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rent">
          {rentals.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No rental gear listed yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rentals.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  {item.imageUrl && <div className="h-36 overflow-hidden"><img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover" /></div>}
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm flex-1">{item.itemName}</h3>
                      <Badge className={`text-[10px] ${CATEGORY_COLORS[item.category] ?? ""}`}>{item.category}</Badge>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>}
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-primary">NPR {item.pricePerDay}/day</span>
                      {item.agencyName && <span className="text-xs text-muted-foreground">{item.agencyName}</span>}
                    </div>
                    {item.depositAmount > 0 && <p className="text-[10px] text-muted-foreground mt-1">Deposit: NPR {item.depositAmount}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="secondhand">
          {secondhand.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No secondhand gear listed yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {secondhand.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  {item.imageUrl && <div className="h-36 overflow-hidden"><img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" /></div>}
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm flex-1">{item.title}</h3>
                      <Badge className={`text-[10px] ${CATEGORY_COLORS[item.category] ?? ""}`}>{item.category}</Badge>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>}
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-bold text-primary">NPR {item.priceNPR.toLocaleString()}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{item.condition.replace("_", " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {item.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{item.location}</span>}
                      {item.sellerUsername && <span>@{item.sellerUsername}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
