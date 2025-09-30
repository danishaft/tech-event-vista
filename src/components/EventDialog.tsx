import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechEvent } from "@/data/sampleEvents";
import { Calendar, MapPin, Users, DollarSign, Star, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EventDialogProps {
  event: TechEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventDialog = ({ event, open, onOpenChange }: EventDialogProps) => {
  if (!event) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTechColor = (tech: string) => {
    const colors: Record<string, string> = {
      'React': 'bg-[#61dafb]/20 text-[#61dafb] border-[#61dafb]/30',
      'Python': 'bg-[#3776ab]/20 text-[#3776ab] border-[#3776ab]/30',
      'JavaScript': 'bg-[#f7df1e]/20 text-[#f7df1e] border-[#f7df1e]/30',
      'TypeScript': 'bg-[#3178c6]/20 text-[#3178c6] border-[#3178c6]/30',
      'AI/ML': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Node.js': 'bg-[#339933]/20 text-[#339933] border-[#339933]/30',
      'AWS': 'bg-[#ff9900]/20 text-[#ff9900] border-[#ff9900]/30',
    };
    return colors[tech] || 'bg-muted/20 text-muted-foreground border-border';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading font-bold pr-8">
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Image */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted/50">
            <img 
              src={event.imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3">
              <Badge className={`${event.price === 'Free' ? 'bg-success text-background' : 'bg-background/90 text-foreground'} backdrop-blur-md border-0 font-semibold`}>
                {event.price}
              </Badge>
            </div>
          </div>

          {/* Event Type & Rating */}
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="outline" className="capitalize border-border bg-transparent">
              {event.eventType}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span>{event.organizerRating.toFixed(1)} organizer rating</span>
            </div>
            <Badge variant="outline" className="border-border bg-transparent">
              {event.source}
            </Badge>
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Date & Time</p>
              <p className="text-sm text-muted-foreground">{formatDate(event.date)}</p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Location</p>
              <p className="text-sm text-muted-foreground">{event.neighborhood}, {event.city}</p>
            </div>
          </div>

          {/* Attendees */}
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Attendees</p>
              <p className="text-sm text-muted-foreground">{event.attendees} people going</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="font-medium mb-2">About this event</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Tech Stack */}
          <div>
            <p className="font-medium mb-3">Tech Stack</p>
            <div className="flex flex-wrap gap-2">
              {event.techStack.map((tech) => (
                <span 
                  key={tech} 
                  className={`text-sm px-3 py-1.5 rounded-full border ${getTechColor(tech)}`}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <Button className="w-full" size="lg">
            <ExternalLink className="h-4 w-4 mr-2" />
            View on {event.source}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
