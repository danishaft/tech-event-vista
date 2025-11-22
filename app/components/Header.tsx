import { Bell, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type HeaderProps = {};

export const Header = () => {
	return (
		<header className="bg-background border-b border-border px-4 py-3 sticky top-0 z-50 backdrop-blur-sm shadow-sm">
			<div className="max-w-7xl mx-auto flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link
						href="/"
						className="flex items-center gap-2 hover:opacity-80 transition-opacity"
					>
						<Image
							src="/logo.svg"
							alt="Tech Event Vista Logo"
							width={32}
							height={32}
							className="w-8 h-8"
							priority
						/>
						<span className="font-heading font-bold text-xl">
							Tech Event Vista
						</span>
					</Link>
				</div>

				{/* User Actions */}
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" className="relative">
						<Bell className="h-5 w-5" />
						
					</Button>
					<Button variant="ghost" size="icon">
						<User className="h-5 w-5" />
					</Button>
				</div>
			</div>
		</header>
	);
};
