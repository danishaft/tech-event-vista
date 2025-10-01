import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEvents } from "@/hooks/useEvents";
import { Loader2 } from "lucide-react";

export const ScraperControls = () => {
  const [city, setCity] = useState("San Francisco");
  const [platform, setPlatform] = useState<string>("all");
  const { scrapeEvents, isScraping } = useEvents();

  const handleScrape = () => {
    scrapeEvents({ 
      platform: platform === "all" ? undefined : platform, 
      city 
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Event Scraper</CardTitle>
        <CardDescription>
          Scrape tech events from Eventbrite, Meetup, and Luma
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">City</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter city name"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Platform</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="luma">Luma</SelectItem>
                <SelectItem value="eventbrite">Eventbrite</SelectItem>
                <SelectItem value="meetup">Meetup</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button 
          onClick={handleScrape} 
          disabled={isScraping}
          className="w-full"
        >
          {isScraping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            'Start Scraping'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
