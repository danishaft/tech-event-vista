"use client";

import { Calendar, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomNavigation } from "@/components/BottomNavigation";
import { DiscoverEventsSection } from "@/components/DiscoverEventsSection";
import { FeaturedEvents } from "@/components/FeaturedEvents";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomePage() {
	const router = useRouter();
	const [activeTab] = useState("home");
	const [date, setDate] = useState("");
	const [searchQuery, setSearchQuery] = useState("");

	const handleSearch = () => {
		// Navigate to events page with search params
		const params = new URLSearchParams();
		if (searchQuery.trim()) params.set("q", searchQuery.trim());
		if (date.trim()) params.set("date", date.trim());
		router.push(`/events?${params.toString()}`);
	};

	return (
		<div className="min-h-screen bg-background">
			<Header />

			<main className="pb-20 md:pb-8">
				{/* Hero Section */}
				<div className="relative min-h-[600px] md:min-h-[700px] flex items-center justify-center overflow-hidden">
					{/* Background with gradient overlay */}
					<div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
						<div
							className="absolute inset-0 opacity-20"
							style={{
								backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
							}}
						></div>
					</div>

					{/* Content */}
					<div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20">
						{/* Hero Text */}
						<div className="text-center mb-12">
							<p className="text-muted-foreground text-lg md:text-xl mb-3 font-medium">
								Best tech events made for you in mind!
							</p>
							<h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
								Discover Amazing
								<span className="block text-primary">Tech Events</span>
							</h1>
							<p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
								Find workshops, conferences, and meetups that matter to you
							</p>
						</div>

						<div className="max-w-4xl mx-auto mb-16">
							<div className="bg-card rounded-xl md:rounded-2xl shadow-card p-2 md:p-3 flex flex-col md:flex-row gap-2 md:gap-3 border border-border">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
									<Input
										type="text"
										placeholder="Search events, technologies..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleSearch()}
										className="pl-10 h-12 md:h-14 text-base border-0 bg-surface focus-visible:ring-2 focus-visible:ring-primary/20"
									/>
								</div>

								{/* Date Input */}
								<div className="relative flex-1">
									<Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
									<Input
										type="date"
										value={date}
										onChange={(e) => setDate(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleSearch()}
										className="pl-10 h-12 md:h-14 text-base border-0 bg-surface focus-visible:ring-2 focus-visible:ring-primary/20"
									/>
								</div>

								{/* Search Button */}
								<Button
									onClick={handleSearch}
									className="h-12 md:h-14 px-8 md:px-12 bg-primary hover:bg-primary-hover text-primary-foreground rounded-doow-sm md:rounded-doow-md font-semibold text-base shadow-lg hover:shadow-xl transition-all"
								>
									<Search className="h-5 w-5 mr-2" />
									Search
								</Button>
							</div>
						</div>
					</div>
				</div>

				<FeaturedEvents />
				<DiscoverEventsSection />
			</main>

			<Footer />
			<BottomNavigation activeTab={activeTab} onTabChange={() => {}} />
		</div>
	);
}
