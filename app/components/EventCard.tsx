import { Calendar, Heart, MapPin } from "lucide-react";
import moment from "moment";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Event } from "@/hooks/useEvents";

interface EventCardProps {
	event: Event;
	onClick: () => void;
}

export const EventCard = ({ event, onClick }: EventCardProps) => {
	const [isSaved, setIsSaved] = useState(false);

	const formatDate = (dateString: string) => {
		return moment(dateString).format("MMM D, YYYY");
	};

	const formatPrice = () => {
		if (event.isFree) return "Free";
		if (event.priceMin && event.priceMin > 0) return `$${event.priceMin}`;
		return "--";
	};

	const formatLocation = () => {
		if (event.isOnline) return "Online";
		return event.venueName || event.city || "TBD";
	};

	const formatSource = () => {
		const sourceMap: Record<string, "Eventbrite" | "Luma" | "Meetup"> = {
			eventbrite: "Eventbrite",
			luma: "Luma",
			meetup: "Meetup",
		};
		return sourceMap[event.sourcePlatform] || "Luma";
	};

	const getTechColor = (tech: string) => {
		const colors: Record<string, string> = {
			React: "bg-[#61dafb]/20 text-[#61dafb] border-[#61dafb]/30",
			Python: "bg-[#3776ab]/20 text-[#3776ab] border-[#3776ab]/30",
			JavaScript: "bg-[#f7df1e]/20 text-[#f7df1e] border-[#f7df1e]/30",
			TypeScript: "bg-[#3178c6]/20 text-[#3178c6] border-[#3178c6]/30",
			"AI/ML": "bg-purple-500/20 text-purple-400 border-purple-500/30",
			"Node.js": "bg-[#339933]/20 text-[#339933] border-[#339933]/30",
			AWS: "bg-[#ff9900]/20 text-[#ff9900] border-[#ff9900]/30",
		};
		return colors[tech] || "bg-muted/20 text-muted-foreground border-border";
	};

	return (
		<Card
			className="group relative bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover cursor-pointer rounded-lg h-full flex flex-col"
			onClick={onClick}
		>
			<article className="flex flex-col h-full">
				<figure className="relative w-[calc(100%-24px)] h-48 md:h-56 overflow-hidden bg-muted/50 mx-3 mt-3 rounded-lg">
					{event.imageUrl && (
						<Image
							src={event.imageUrl}
							alt={event.title}
							fill
							className="object-cover transition-transform duration-500 group-hover:scale-105"
							sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
							unoptimized
						/>
					)}

					<div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent"></div>

					<div className="absolute top-3 left-3">
						<Badge
							className={`${formatPrice() === "Free" ? "bg-success text-white" : "bg-card/95 text-foreground"} border-0 font-semibold text-sm px-3 py-1 shadow-md`}
						>
							{formatPrice()}
						</Badge>
					</div>

					<Button
						onClick={(e) => {
							e.stopPropagation();
							setIsSaved(!isSaved);
						}}
						variant="ghost"
						size="icon"
						className="absolute top-3 right-3 p-2 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-200 hover:scale-110 shadow-md"
						aria-label={isSaved ? "Remove from saved" : "Save event"}
					>
						<Heart
							className={`h-5 w-5 transition-all ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`}
						/>
					</Button>
				</figure>

				<div className="p-5 md:p-6 space-y-3 flex-1 flex flex-col">
					<h3 className="font-heading font-bold text-lg md:text-xl leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
						{event.title}
					</h3>

					<dl className="space-y-2">
						<div className="flex items-center gap-2 text-muted-foreground">
							<Calendar className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
							<dt className="sr-only">Date</dt>
							<dd>
								<time
									dateTime={event.eventDate}
									className="text-sm font-medium"
								>
									{formatDate(event.eventDate)}
								</time>
							</dd>
						</div>
						<div className="flex items-center gap-2 text-muted-foreground">
							<MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
							<dt className="sr-only">Location</dt>
							<dd className="text-sm truncate">
								{event.venueAddress ? `${event.venueAddress}, ` : ""}
								{event.city || "TBD"}
							</dd>
						</div>
					</dl>

					<div
						className="flex flex-wrap gap-2 pt-2 mt-auto"
						role="list"
						aria-label="Tech stack"
					>
						{event.techStack.slice(0, 3).map((tech) => (
							<span
								key={tech}
								role="listitem"
								className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getTechColor(tech)}`}
							>
								{tech}
							</span>
						))}
						{event.techStack.length > 3 && (
							<span className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/20 text-muted-foreground font-medium">
								+{event.techStack.length - 3}
							</span>
						)}
					</div>
				</div>
			</article>
		</Card>
	);
};
