import { useState } from "react";
import { Link } from "wouter";
import { useListTreks } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar, Users, Filter, Loader2 } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";

export default function TreksList() {
  const [destination, setDestination] = useState("");
  const [difficulty, setDifficulty] = useState<string>("all");
  
  const { data: treks, isLoading } = useListTreks({
    destination: destination || undefined,
    difficulty: difficulty !== "all" ? difficulty : undefined,
  });

  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({
    query: { enabled: isAuthenticated },
  });

  const isAgency = profile?.role === "agency";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Discover Treks</h1>
          <p className="text-muted-foreground">Find your next Himalayan adventure</p>
        </div>
        {isAgency && (
          <Button asChild>
            <Link href="/dashboard">Create New Trek</Link>
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-8 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Destination</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="e.g. Everest, Annapurna..." 
              className="pl-9"
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-64">
          <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Difficulty</label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Any Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Difficulty</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
              <SelectItem value="extreme">Extreme</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" className="w-full md:w-auto">
          <Filter className="w-4 h-4 mr-2" /> Filters
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : treks?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No treks found</h3>
          <p className="text-muted-foreground">Try adjusting your filters to find what you're looking for.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {treks?.map(trek => (
            <Link key={trek.id} href={`/treks/${trek.id}`}>
              <Card className="overflow-hidden h-full hover-elevate transition-all border-border group cursor-pointer">
                <div className="h-48 relative overflow-hidden">
                  <img 
                    src={trek.imageUrl || `/images/trek-${(parseInt(trek.id, 36) % 2) + 1}.png`} 
                    alt={trek.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-2.5 py-0.5 rounded text-sm font-semibold shadow-sm">
                    ${trek.price}
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-1.5 text-xs text-primary font-bold uppercase tracking-wider mb-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {trek.destination}
                  </div>
                  <h3 className="text-lg font-serif font-bold mb-3 line-clamp-2">{trek.title}</h3>
                  
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {trek.duration} Days
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Max {trek.maxGroupSize} ({trek.currentParticipants} joined)
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div className="text-xs font-medium px-2 py-1 bg-secondary/10 text-secondary rounded">
                      {trek.difficultyLevel}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}