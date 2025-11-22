"use client";

import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const Footer = () => {
	return (
		<footer className="bg-card border-t border-border mt-spacing-section">
			<div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
					{/* Brand Column */}
					<div className="lg:col-span-1">
						<Link
							href="/"
							className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
						>
							<Image
								src="/logo.svg"
								alt="Tech Event Vista Logo"
								width={40}
								height={40}
								className="w-10 h-10"
							/>
							<span className="font-heading font-bold text-xl">
								Tech Event Vista
							</span>
						</Link>
						<p className="text-muted-foreground text-sm leading-relaxed mb-4">
							Discover and explore amazing tech events, conferences, workshops,
							and meetups. Your gateway to the tech community.
						</p>
						<p className="text-muted-foreground-light text-xs">
							Powered by Next.js
						</p>
					</div>

					<nav aria-label="Destinations">
						<h3 className="font-semibold text-foreground mb-4 text-base">
							Destinations
						</h3>
						<ul className="space-y-2">
							<li>
								<Link
									href="/events?city=san-francisco"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									San Francisco
								</Link>
							</li>
							<li>
								<Link
									href="/events?city=new-york"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									New York
								</Link>
							</li>
							<li>
								<Link
									href="/events?city=seattle"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Seattle
								</Link>
							</li>
							<li>
								<Link
									href="/events?city=austin"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Austin
								</Link>
							</li>
							<li>
								<Link
									href="/events?city=boston"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Boston
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label="Event Types">
						<h3 className="font-semibold text-foreground mb-4 text-base">
							Event Types
						</h3>
						<ul className="space-y-2">
							<li>
								<Link
									href="/events?q=conference"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Conferences
								</Link>
							</li>
							<li>
								<Link
									href="/events?q=workshop"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Workshops
								</Link>
							</li>
							<li>
								<Link
									href="/events?q=meetup"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Meetups
								</Link>
							</li>
							<li>
								<Link
									href="/events?q=hackathon"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Hackathons
								</Link>
							</li>
							<li>
								<Link
									href="/events?q=networking"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									Networking
								</Link>
							</li>
							<li>
								<Link
									href="/events?q=ai"
									className="text-muted-foreground text-sm hover:text-primary transition-colors"
								>
									AI & ML
								</Link>
							</li>
						</ul>
					</nav>

					{/* Get in Touch Column */}
					<div>
						<h3 className="font-semibold text-foreground mb-4 text-base">
							Get in Touch
						</h3>
						<p className="text-muted-foreground text-sm mb-4">
							Connect with us on social media
						</p>
						<div className="flex items-center gap-3">
							<a
								href="https://facebook.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors group"
								aria-label="Facebook"
							>
								<Facebook className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
							</a>
							<a
								href="https://instagram.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors group"
								aria-label="Instagram"
							>
								<Instagram className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
							</a>
							<a
								href="https://linkedin.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors group"
								aria-label="LinkedIn"
							>
								<Linkedin className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
							</a>
							<a
								href="https://twitter.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors group"
								aria-label="Twitter"
							>
								<Twitter className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
							</a>
						</div>
					</div>
				</div>

				<nav
					className="mt-12 pt-8 border-t border-border"
					aria-label="Footer links"
				>
					<div className="flex flex-col md:flex-row items-center justify-between gap-4">
						<p className="text-muted-foreground-light text-xs text-center md:text-left">
							© {new Date().getFullYear()} Tech Event Vista. All rights
							reserved.
						</p>
						<ul className="flex items-center gap-6 list-none m-0 p-0">
							<li>
								<Link
									href="/terms"
									className="text-muted-foreground-light text-xs hover:text-primary transition-colors"
								>
									Terms
								</Link>
							</li>
							<li>
								<Link
									href="/privacy"
									className="text-muted-foreground-light text-xs hover:text-primary transition-colors"
								>
									Privacy
								</Link>
							</li>
							<li>
								<Link
									href="/security"
									className="text-muted-foreground-light text-xs hover:text-primary transition-colors"
								>
									Security
								</Link>
							</li>
						</ul>
					</div>
				</nav>
			</div>
		</footer>
	);
};
