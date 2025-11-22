import { Bookmark, Home, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomNavigationProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
}

export const BottomNavigation = ({
	activeTab,
	onTabChange,
}: BottomNavigationProps) => {
	const tabs = [
		{ id: "home", label: "Home", icon: Home },
		{ id: "saved", label: "Saved", icon: Bookmark },
		{ id: "search", label: "Search", icon: Search },
		{ id: "profile", label: "Profile", icon: User },
	];

	return (
		<nav
			className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-2 z-50"
			aria-label="Main navigation"
		>
			<ul className="flex justify-around list-none m-0 p-0">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;

					return (
						<li key={tab.id}>
							<Button
								variant="ghost"
								size="sm"
								className={`flex flex-col items-center gap-1 h-12 w-16 ${
									isActive ? "text-primary" : "text-muted-foreground"
								}`}
								onClick={() => onTabChange(tab.id)}
								aria-label={tab.label}
								aria-current={isActive ? "page" : undefined}
							>
								<Icon className="h-5 w-5" aria-hidden="true" />
								<span className="text-xs">{tab.label}</span>
							</Button>
						</li>
					);
				})}
			</ul>
		</nav>
	);
};
