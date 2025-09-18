import { Calendar, MapPin, Users, Star, Clock, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { TechEvent } from "@/data/sampleEvents";

interface EventCardProps {
  event: TechEvent;
}

export const EventCard = ({ event }: EventCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getEventTypeColor = (type: string) => {
    const colors = {
      workshop: "bg-primary text-primary-foreground",
      conference: "bg-accent text-accent-foreground", 
      meetup: "bg-success text-foreground",
      hackathon: "bg-warning text-foreground",
      networking: "bg-info text-foreground"
    };
    return colors[type as keyof typeof colors] || "bg-muted text-muted-foreground";
  };

  return (
    <Card className="bg-card border-border hover:bg-surface-hover transition-all duration-200 hover:shadow-custom-md group">
      <CardHeader className="p-0">
        <div className="relative overflow-hidden rounded-t-lg">
          <img 
            src={event.imageUrl} 
            alt={event.title}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className={getEventTypeColor(event.eventType)}>
              {event.eventType}
            </Badge>
            {event.isSoldOut && (
              <Badge variant="destructive">Sold Out</Badge>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {event.source}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-heading font-semibold text-lg leading-tight mb-2 line-clamp-2">
              {event.title}
            </h3>
            <p className="text-muted-foreground text-sm line-clamp-2">
              {event.description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{event.time}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{event.neighborhood}, {event.city}</span>
            </div>
            {!event.isOnline && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{event.attendees}/{event.maxAttendees}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-accent fill-current" />
              <span className="text-sm font-medium">{event.organizerRating}</span>
              <span className="text-xs text-muted-foreground">• {event.organizer}</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              <span>{event.price}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {event.techStack.slice(0, 3).map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
            {event.techStack.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{event.techStack.length - 3}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full" 
          variant={event.isSoldOut ? "secondary" : "default"}
          disabled={event.isSoldOut}
        >
          {event.isSoldOut ? "Sold Out" : "Register"}
        </Button>
      </CardFooter>
    </Card>
  );
};