import { Calendar, ExternalLink, MapPin, Star, Users } from "lucide-react";
import moment from "moment";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Event } from "@/hooks/useEvents";

interface EventDialogProps {
	event: Event | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const TECH_COLORS: Record<string, string> = {
	React: "bg-[#61dafb]/20 text-[#61dafb] border-[#61dafb]/30",
	Python: "bg-[#3776ab]/20 text-[#3776ab] border-[#3776ab]/30",
	JavaScript: "bg-[#f7df1e]/20 text-[#f7df1e] border-[#f7df1e]/30",
	TypeScript: "bg-[#3178c6]/20 text-[#3178c6] border-[#3178c6]/30",
	"AI/ML": "bg-purple-500/20 text-purple-400 border-purple-500/30",
	"Node.js": "bg-[#339933]/20 text-[#339933] border-[#339933]/30",
	AWS: "bg-[#ff9900]/20 text-[#ff9900] border-[#ff9900]/30",
};

const SOURCE_MAP: Record<string, "Eventbrite" | "Luma" | "Meetup"> = {
	eventbrite: "Eventbrite",
	luma: "Luma",
	meetup: "Meetup",
};

export const EventDialog = ({
	event,
	open,
	onOpenChange,
}: EventDialogProps) => {
	if (!event) return null;

	const price = event.isFree
		? "Free"
		: event.priceMin && event.priceMin > 0
			? `$${event.priceMin}`
			: "--";
	const locationParts = [event.venueAddress, event.city].filter(Boolean);
	const location = event.isOnline
		? "Online"
		: locationParts.length > 0
			? locationParts.join(", ")
			: "TBD";
	const source = SOURCE_MAP[event.sourcePlatform] || "Luma";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
				<DialogHeader>
					<DialogTitle className="text-2xl font-heading font-bold pr-8">
						{event.title}
					</DialogTitle>
				</DialogHeader>

				<article className="space-y-6">
					<figure className="relative aspect-video rounded-lg overflow-hidden bg-muted/50">
						{event.imageUrl && (
							<Image
								src={event.imageUrl}
								alt={event.title}
								fill
								className="object-cover"
								sizes="(max-width: 768px) 100vw, 768px"
								unoptimized
							/>
						)}
						<div className="absolute top-3 left-3">
							<Badge
								className={`${price === "Free" ? "bg-success text-background" : "bg-background/90 text-foreground"} backdrop-blur-md border-0 font-semibold`}
							>
								{price}
							</Badge>
						</div>
					</figure>

					<div className="flex items-center gap-4 flex-wrap">
						<Badge
							variant="outline"
							className="capitalize border-border bg-transparent"
						>
							{event.eventType}
						</Badge>
						{event.organizerRating && (
							<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
								<Star
									className="h-4 w-4 fill-warning text-warning"
									aria-hidden="true"
								/>
								<span>{event.organizerRating.toFixed(1)} organizer rating</span>
							</div>
						)}
						<Badge variant="outline" className="border-border bg-transparent">
							{source}
						</Badge>
					</div>

					<dl className="space-y-4">
						<div className="flex items-start gap-3">
							<Calendar
								className="h-5 w-5 text-primary flex-shrink-0 mt-0.5"
								aria-hidden="true"
							/>
							<div>
								<dt className="font-medium">Date & Time</dt>
								<dd className="text-sm text-muted-foreground">
									<time dateTime={event.eventDate}>
										{moment(event.eventDate).format(
											"dddd, MMMM D, YYYY [at] h:mm A",
										)}
									</time>
								</dd>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<MapPin
								className="h-5 w-5 text-primary flex-shrink-0 mt-0.5"
								aria-hidden="true"
							/>
							<div>
								<dt className="font-medium">Location</dt>
								<dd className="text-sm text-muted-foreground">{location}</dd>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<Users
								className="h-5 w-5 text-primary flex-shrink-0 mt-0.5"
								aria-hidden="true"
							/>
							<div>
								<dt className="font-medium">Attendees</dt>
								<dd className="text-sm text-muted-foreground">
									{event.registeredCount} people going
								</dd>
							</div>
						</div>
					</dl>

					{event.description && (
						<section>
							<h4 className="font-medium mb-2">About this event</h4>
							<p className="text-sm text-muted-foreground leading-relaxed">
								{event.description}
							</p>
						</section>
					)}

					<section>
						<h4 className="font-medium mb-3">Tech Stack</h4>
						<ul className="flex flex-wrap gap-2 list-none m-0 p-0" role="list">
							{event.techStack.map((tech) => (
								<li key={tech} role="listitem">
									<span
										className={`text-sm px-3 py-1.5 rounded-full border ${TECH_COLORS[tech] || "bg-muted/20 text-muted-foreground border-border"}`}
									>
										{tech}
									</span>
								</li>
							))}
						</ul>
					</section>

					{/* CTA Button */}
					<Button
						className="w-full"
						size="lg"
						onClick={() => {
							if (event.externalUrl) {
								window.open(event.externalUrl, "_blank", "noopener,noreferrer");
							}
						}}
						disabled={!event.externalUrl}
					>
						<ExternalLink className="mr-2 h-4 w-4" />
						{event.externalUrl
							? "Register for Event"
							: "Event URL Not Available"}
					</Button>
				</article>
			</DialogContent>
		</Dialog>
	);
};
