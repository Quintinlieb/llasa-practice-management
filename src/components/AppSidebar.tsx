import { FileText, Users, Home, CalendarClock, ArrowLeft } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "sidebar:collapsed";
type SidebarProfile = {
  user_name: string;
  user_surname: string;
  user_email: string;
};

const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Calendar", url: "/calendar", icon: CalendarClock },
];

export function AppSidebar({ profile }: { profile?: SidebarProfile }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const setCollapsed = (value: boolean) => {
    setIsCollapsed(value);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  };

  const withTooltip = (element: ReactElement, label: string) =>
    isCollapsed ? (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{element}</TooltipTrigger>
          <TooltipContent side="right" className="drop-shadow-md">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      element
    );

  const pathname = location.pathname;
  const initials =
    profile?.user_name && profile?.user_surname
      ? `${profile.user_name.charAt(0)}${profile.user_surname.charAt(0)}`.toUpperCase()
      : "U";

  return (
    <Sidebar
      collapsible="none"
      className={cn(
        "relative h-full flex flex-col glass-panel !bg-white/60 !backdrop-blur-2xl !border-white/60 rounded-2xl overflow-visible transition-[width] duration-200",
        isCollapsed ? "w-[4.5rem]" : "w-48",
      )}
    >
      <Button
        variant="default"
        size="icon"
        className="absolute right-[-10px] top-14 z-50 h-7 w-7 rounded-full bg-white/70 text-primary border border-primary/20 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm hover:bg-white hover:border-primary/30 hover:shadow-[0_14px_38px_-14px_rgba(0,0,0,0.38)]"
        onClick={() => setCollapsed(!isCollapsed)}
      >
        <ArrowLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
        <span className="sr-only">Collapse sidebar</span>
      </Button>
      <div className="flex h-full flex-col rounded-2xl overflow-hidden bg-transparent">
        <div className={cn("flex items-center justify-center pt-4 pb-2 mb-4 h-16", isCollapsed ? "px-2" : "px-4")}>
          <img
            src={isCollapsed ? "/thumbnail-logo.svg" : "/mainlogo.png"}
            alt="logo"
            className={cn(isCollapsed ? "h-8" : "h-8", "w-auto object-contain")}
            style={{ imageRendering: "crisp-edges" }}
          />
        </div>
        <SidebarContent className={cn("px-4", isCollapsed && "px-2")}>
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className={cn("mt-0 w-full text-center", isCollapsed && "transform -translate-x-1")}>
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {primaryNavItems.map((item) => {
                  const isActive =
                    item.url === "/documents" ? pathname.startsWith("/documents") : location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      {withTooltip(
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "rounded-lg transition-all duration-150 hover:bg-primary/5",
                            isActive &&
                              "bg-white/45 text-primary shadow-[0_10px_25px_-15px_rgba(255,255,255,0.6)] data-[active=true]:!bg-white/45 [&>svg]:text-primary",
                          )}
                          data-collapsed={isCollapsed}
                        >
                          <NavLink
                            to={item.url}
                            className={cn("w-full", isCollapsed && "justify-center gap-0")}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className={cn(isCollapsed && "sr-only")}>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>,
                        item.title
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 mt-auto border-t border-white/40 bg-transparent">
          {profile && (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="leading-tight min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Welcome,</p>
                  <p className="text-xs font-semibold truncate">
                    {profile.user_name} {profile.user_surname}
                  </p>
                </div>
              )}
            </div>
          )}
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
