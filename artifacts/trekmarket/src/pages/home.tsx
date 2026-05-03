import { useGetFeaturedTreks, useGetPopularDestinations } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Users, Calendar, ArrowRight, TrendingUp } from "lucide-react";

export default function Home() {
  const { data: featuredTreks, isLoading: isTreksLoading } = useGetFeaturedTreks();
  const { data: destinations, isLoading: isDestLoading } = useGetPopularDestinations();

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/40 z-10" />
        <img 
          src="/images/hero.png" 
          alt="Himalayan sunrise hiker" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 container mx-auto px-4 text-center">
          <p className="text-sm md:text-base font-semibold uppercase tracking-[0.3em] text-white/70 mb-4 animate-in fade-in duration-700">
            Plan. Connect. Trek.
          </p>
          <h1 className="text-6xl md:text-8xl font-serif font-bold text-white mb-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Trekora
          </h1>
          <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            A smart platform to discover, plan, and book trekking experiences with guides and fellow trekkers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <Button asChild size="lg" className="text-lg px-8 py-6 h-auto" data-testid="link-hero-browse">
              <Link href="/treks">Find Your Trek</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6 h-auto bg-white text-black hover:bg-white/90" data-testid="link-hero-custom">
              <Link href="/custom-requests">Request Custom Trip</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats / Trust */}
      <section className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border">
            <div className="px-4">
              <p className="text-4xl font-serif font-bold text-primary mb-2">500+</p>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Verified Treks</p>
            </div>
            <div className="px-4">
              <p className="text-4xl font-serif font-bold text-primary mb-2">50+</p>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Local Agencies</p>
            </div>
            <div className="px-4">
              <p className="text-4xl font-serif font-bold text-primary mb-2">10k+</p>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Trekkers</p>
            </div>
            <div className="px-4">
              <p className="text-4xl font-serif font-bold text-primary mb-2">100%</p>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Secure Booking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Treks */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-serif font-bold mb-4">Featured Expeditions</h2>
              <p className="text-muted-foreground text-lg max-w-2xl">Hand-selected packages from top-rated local agencies. Perfectly planned and ready for booking.</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex group">
              <Link href="/treks">
                View all treks <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {isTreksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[400px] bg-muted animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredTreks?.map(trek => (
                <Link key={trek.id} href={`/treks/${trek.id}`} data-testid={`link-trek-card-${trek.id}`}>
                  <Card className="overflow-hidden h-full hover-elevate transition-all border-border group cursor-pointer">
                    <div className="h-64 relative overflow-hidden">
                      <img 
                        src={trek.imageUrl || `/images/trek-${(parseInt(trek.id, 36) % 2) + 1}.png`} 
                        alt={trek.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                        ${trek.price}
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider mb-3">
                        <MapPin className="w-4 h-4" />
                        {trek.destination}
                      </div>
                      <h3 className="text-xl font-serif font-bold mb-4 line-clamp-2">{trek.title}</h3>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {trek.duration} Days
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Max {trek.maxGroupSize}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-foreground">{trek.agencyName}</span>
                        </div>
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
      </section>

      {/* Popular Destinations */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-bold mb-4">Trending Destinations</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Explore regions that are capturing the imagination of trekkers right now.</p>
          </div>

          {isDestLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-[200px] bg-muted animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {destinations?.map(dest => (
                <Link key={dest.destination} href={`/treks?destination=${dest.destination}`} data-testid={`link-dest-${dest.destination}`}>
                  <div className="group cursor-pointer relative h-[300px] rounded-xl overflow-hidden">
                    <img 
                      src={`/images/trek-${dest.destination === 'Everest Region' ? '1' : '2'}.png`}
                      alt={dest.destination}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-6 w-full">
                      <h3 className="text-white font-serif font-bold text-xl mb-1">{dest.destination}</h3>
                      <p className="text-white/80 text-sm font-medium flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        {dest.trekCount} active treks
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}