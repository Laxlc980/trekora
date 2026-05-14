import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetBooking, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Mountain, ShoppingBag, Store, ExternalLink, MapPin, Phone } from "lucide-react";

// ---------------------------------------------------------------------------
// Static gear data
// ---------------------------------------------------------------------------
type GearItem = { id: string; name: string; amazonSearch: string; thamelSearch: string };

const GEAR_EASY: GearItem[] = [
  { id: "hiking-boots", name: "Hiking Boots", amazonSearch: "hiking+boots+waterproof", thamelSearch: "hiking+boots" },
  { id: "rain-jacket", name: "Rain Jacket", amazonSearch: "waterproof+rain+jacket+hiking", thamelSearch: "rain+jacket" },
  { id: "daypack", name: "Daypack (30-40L)", amazonSearch: "hiking+daypack+30L", thamelSearch: "daypack" },
  { id: "water-bottle", name: "Water Bottle (1L insulated)", amazonSearch: "insulated+water+bottle+hiking", thamelSearch: "water+bottle" },
  { id: "sunscreen", name: "Sunscreen SPF 50+", amazonSearch: "sunscreen+spf50+sport", thamelSearch: "sunscreen" },
];

const GEAR_MODERATE: GearItem[] = [
  { id: "trekking-poles", name: "Trekking Poles", amazonSearch: "trekking+poles+carbon", thamelSearch: "trekking+poles" },
  { id: "thermal-layers", name: "Thermal Base Layers", amazonSearch: "merino+thermal+base+layer", thamelSearch: "thermal+layers" },
  { id: "sleeping-bag", name: "Sleeping Bag (-10°C)", amazonSearch: "sleeping+bag+minus+10", thamelSearch: "sleeping+bag" },
  { id: "headlamp", name: "Headlamp (rechargeable)", amazonSearch: "rechargeable+headlamp+hiking", thamelSearch: "headlamp" },
];

const GEAR_STRENUOUS: GearItem[] = [
  { id: "down-jacket", name: "Down Jacket (800+ fill)", amazonSearch: "down+jacket+800+fill+mountaineering", thamelSearch: "down+jacket" },
  { id: "crampons", name: "Crampons", amazonSearch: "mountaineering+crampons", thamelSearch: "crampons" },
  { id: "altitude-meds", name: "Altitude Sickness Medication (Diamox)", amazonSearch: "altitude+sickness+prevention", thamelSearch: "diamox" },
  { id: "satellite-comm", name: "Satellite Communicator", amazonSearch: "satellite+communicator+garmin+inreach", thamelSearch: "satellite+communicator" },
];

function getGearList(difficulty: string | undefined, altitude: number | null): GearItem[] {
  const items = [...GEAR_EASY];
  const diff = difficulty?.toLowerCase() ?? "easy";
  const alt = altitude ?? 0;

  if (diff === "moderate" || diff === "hard" || diff === "extreme" || alt >= 3000) {
    items.push(...GEAR_MODERATE);
  }
  if (diff === "hard" || diff === "extreme" || alt >= 5000) {
    items.push(...GEAR_STRENUOUS);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Static rental shops
// ---------------------------------------------------------------------------
type RentalShop = { name: string; location: string; phone: string; url: string };

const RENTAL_SHOPS: RentalShop[] = [
  { name: "Shona's Alpine Rentals", location: "Thamel, Kathmandu", phone: "+977-1-4700123", url: "https://maps.google.com/?q=Shona+Alpine+Rentals+Thamel" },
  { name: "Himalayan Gear House", location: "Lakeside, Pokhara", phone: "+977-61-462345", url: "https://maps.google.com/?q=Himalayan+Gear+House+Pokhara" },
  { name: "Mountain Hardwear Rental", location: "Jyatha, Kathmandu", phone: "+977-1-4701567", url: "https://maps.google.com/?q=Mountain+Hardwear+Rental+Kathmandu" },
  { name: "Everest Gear Rental", location: "Thamel North, Kathmandu", phone: "+977-1-4700890", url: "https://maps.google.com/?q=Everest+Gear+Rental+Thamel" },
  { name: "Annapurna Outfitters", location: "Lakeside Rd, Pokhara", phone: "+977-61-465678", url: "https://maps.google.com/?q=Annapurna+Outfitters+Pokhara" },
];

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
function getCheckedItems(bookingId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`gear_${bookingId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveCheckedItems(bookingId: string, items: Set<string>) {
  try { localStorage.setItem(`gear_${bookingId}`, JSON.stringify([...items])); } catch {}
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GearGuidePage() {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) },
  });

  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) setChecked(getCheckedItems(id));
  }, [id]);

  const toggle = (itemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      saveCheckedItems(id, next);
      return next;
    });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!booking) return <div className="text-center py-20">Booking not found.</div>;

  const trek = booking.trek;
  const gearList = getGearList(trek?.difficultyLevel, (trek as any)?.maxAltitudeMeters ?? null);
  const checkedCount = gearList.filter((g) => checked.has(g.id)).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href={`/bookings/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Booking
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <Mountain className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-serif font-bold">Gear Guide</h1>
      </div>
      {trek && (
        <p className="text-muted-foreground mb-8">
          Recommended gear for <span className="font-medium text-foreground">{trek.title}</span> — {trek.difficultyLevel} difficulty
          {(trek as any)?.maxAltitudeMeters ? `, up to ${((trek as any).maxAltitudeMeters as number).toLocaleString()}m altitude` : ""}
        </p>
      )}

      {/* Checklist */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Checklist</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {checkedCount}/{gearList.length} packed
            </Badge>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${gearList.length > 0 ? (checkedCount / gearList.length) * 100 : 0}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {gearList.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                checked.has(item.id) ? "opacity-60" : ""
              }`}
            >
              <Checkbox
                checked={checked.has(item.id)}
                onCheckedChange={() => toggle(item.id)}
              />
              <span className={`text-sm ${checked.has(item.id) ? "line-through text-muted-foreground" : "font-medium"}`}>
                {item.name}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Rent / Buy tabs */}
      <Tabs defaultValue="rent" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="rent" className="gap-1.5"><Store className="w-3.5 h-3.5" /> Rent Gear</TabsTrigger>
          <TabsTrigger value="buy" className="gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Buy Online</TabsTrigger>
        </TabsList>

        <TabsContent value="rent">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Trusted gear rental shops in Kathmandu and Pokhara. Most offer daily/weekly rates and accept walk-ins.
            </p>
            {RENTAL_SHOPS.map((shop) => (
              <Card key={shop.name} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">{shop.name}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {shop.location}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {shop.phone}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a href={shop.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Directions
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="buy">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Quick links to buy each item online. Prices and availability may vary.
            </p>
            {gearList.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border">
                <span className="text-sm font-medium">{item.name}</span>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.amazon.com/s?k=${item.amazonSearch}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs gap-1"
                    >
                      Amazon
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.thamel.com/search?q=${item.thamelSearch}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs gap-1"
                    >
                      Thamel.com
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
