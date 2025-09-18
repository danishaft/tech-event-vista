import { Calendar, MapPin, Users, Star, Clock, DollarSign, Heart, Bookmark, Monitor, MapPin as Location } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TechEvent } from "@/data/sampleEvents";
import { useState } from "react";

interface EventCardProps {
  event: TechEvent;
}

export const EventCard = ({ event }: EventCardProps) => {
  const [isSaved, setIsSaved] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getTechStackColor = (tech: string) => {
    const colors: { [key: string]: string } = {
      'React': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'Vue.js': 'bg-green-500/10 text-green-400 border-green-500/20',
      'Angular': 'bg-red-500/10 text-red-400 border-red-500/20',
      'Python': 'bg-green-500/10 text-green-400 border-green-500/20',
      'JavaScript': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'TypeScript': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'AI/ML': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'Machine Learning': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'TensorFlow': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'Node.js': 'bg-green-500/10 text-green-400 border-green-500/20',
      'Go': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      'Rust': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'Docker': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'Kubernetes': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'AWS': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'Next.js': 'bg-black/10 text-white border-gray-500/20',
      'Flutter': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'Unity': 'bg-black/10 text-white border-gray-500/20',
      'Blockchain': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'Web3': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'Solidity': 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    };
    return colors[tech] || 'bg-muted text-muted-foreground border-border';
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'workshop': return '🛠️';
      case 'conference': return '🎤';
      case 'meetup': return '👥';
      case 'hackathon': return '💻';
      case 'networking': return '🤝';
      default: return '📅';
    }
  };

  const getSourceLogo = (source: string) => {
    const logos = {
      'Eventbrite': '🎫',
      'Meetup': '🗓️',
      'Luma': '✨'
    };
    return logos[source as keyof typeof logos] || '📅';
  };

  return (
    <Card className="bg-card border-border hover:shadow-lg transition-all duration-200 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {/* Event Image */}
          <div className="relative w-30 h-20 flex-shrink-0">
            <img 
              src={event.imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-background/90 backdrop-blur-sm">
                {getSourceLogo(event.source)} {event.source}
              </Badge>
            </div>
            {event.qualityScore >= 9.0 && (
              <div className="absolute bottom-2 left-2">
                <Badge className="text-xs px-1.5 py-0.5 bg-accent text-accent-foreground">
                  ⭐ Featured
                </Badge>
              </div>
            )}
          </div>

          {/* Event Content */}
          <div className="flex-1 p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{getEventTypeIcon(event.eventType)}</span>
                  <h3 className="font-semibold text-base leading-tight truncate">
                    {event.title}
                  </h3>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(event.date)} • {event.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {event.isOnline ? <Monitor className="h-3 w-3" /> : <Location className="h-3 w-3" />}
                    <span className="truncate">
                      {event.isOnline ? 'Online' : `${event.neighborhood}, ${event.city}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{event.organizerRating}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground truncate">{event.organizer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">{event.price}</span>
                    {!event.isOnline && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{event.attendees}/{event.maxAttendees}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {event.techStack.slice(0, 4).map((tech) => (
                    <Badge 
                      key={tech} 
                      variant="outline" 
                      className={`text-xs px-2 py-0.5 border ${getTechStackColor(tech)}`}
                    >
                      {tech}
                    </Badge>
                  ))}
                  {event.techStack.length > 4 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      +{event.techStack.length - 4}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsSaved(!isSaved)}
                >
                  <Heart 
                    className={`h-4 w-4 transition-colors ${
                      isSaved ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'
                    }`} 
                  />
                </Button>
                <Button
                  variant={event.isSoldOut ? "secondary" : "default"}
                  size="sm"
                  disabled={event.isSoldOut}
                  className="text-xs px-3 py-1 h-7"
                >
                  {event.isSoldOut ? "Sold Out" : "Register"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};