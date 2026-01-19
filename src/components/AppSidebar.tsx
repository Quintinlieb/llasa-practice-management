import { FileText, Users, Home, CalendarClock, ArrowLeft, Headset, Bell, Settings, LogOut } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useState, type ReactElement } from "react";
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
import { useAuth } from "@/hooks/useAuth";

const SIDEBAR_COLLAPSED_KEY = "sidebar:collapsed";
const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Calendar", url: "/calendar", icon: CalendarClock },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!user?.id) return;
    setCollapsed(false);
  }, [user?.id]);

  const setCollapsed = (value: boolean) => {
    setIsCollapsed(value);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  };

  useLayoutEffect(() => {
    const width = isCollapsed ? "6.5rem" : "14rem";
    document.documentElement.style.setProperty("--app-sidebar-width", width);
  }, [isCollapsed]);

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
  return (
    <Sidebar
      collapsible="none"
      className={cn(
        "relative h-full flex flex-col rounded-2xl bg-white border border-slate-300 overflow-visible transition-[width] duration-200",
        isCollapsed ? "w-[4.5rem]" : "w-48",
      )}
      style={{ backgroundColor: "#ffffff" }}
    >
      <Button
        variant="default"
        size="icon"
        className="absolute right-[-10px] top-14 z-50 h-7 w-7 rounded-full bg-white text-primary border border-primary/20 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] hover:bg-white hover:border-primary/30 hover:shadow-[0_14px_38px_-14px_rgba(0,0,0,0.38)]"
        onClick={() => setCollapsed(!isCollapsed)}
      >
        <ArrowLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
        <span className="sr-only">Collapse sidebar</span>
      </Button>
      <div className="flex h-full flex-col rounded-2xl overflow-hidden bg-white" style={{ backgroundColor: "#ffffff" }}>
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
                              "bg-white text-primary shadow-[0_10px_25px_-15px_rgba(255,255,255,0.6)] data-[active=true]:!bg-white [&>svg]:text-primary",
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

        <SidebarFooter className="p-4 mt-auto border-t border-border bg-white" style={{ backgroundColor: "#ffffff" }}>
          <SidebarMenu className="gap-2">
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "rounded-lg transition-all duration-150 hover:bg-primary/5",
                    isCollapsed && "justify-center gap-0",
                    location.pathname === "/settings" &&
                      "bg-white text-primary shadow-[0_10px_25px_-15px_rgba(255,255,255,0.6)] data-[active=true]:!bg-white [&>svg]:text-primary",
                  )}
                  isActive={location.pathname === "/settings"}
                  data-collapsed={isCollapsed}
                >
                  <NavLink to="/settings" className="w-full">
                    <Settings className="h-5 w-5" />
                    <span className={cn(isCollapsed && "sr-only")}>Settings</span>
                  </NavLink>
                </SidebarMenuButton>,
                "Settings"
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "rounded-lg transition-all duration-150 hover:bg-primary/5",
                    isCollapsed && "justify-center gap-0",
                  )}
                  data-collapsed={isCollapsed}
                >
                  <Bell className="h-5 w-5" />
                  <span className={cn(isCollapsed && "sr-only")}>Notifications</span>
                </SidebarMenuButton>,
                "Notifications"
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "rounded-lg transition-all duration-150 hover:bg-primary/5",
                    isCollapsed && "justify-center gap-0",
                  )}
                  data-collapsed={isCollapsed}
                >
                  <Headset className="h-5 w-5" />
                  <span className={cn(isCollapsed && "sr-only")}>Support</span>
                </SidebarMenuButton>,
                "Support"
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "group rounded-lg bg-primary text-primary-foreground transition-all duration-150 hover:bg-primary/90 hover:text-black [&>span]:transition-colors [&>span]:duration-150 [&>svg]:transition-colors [&>svg]:duration-150",
                    isCollapsed && "justify-center gap-0",
                  )}
                  data-collapsed={isCollapsed}
                  onClick={async () => {
                    const { error } = await signOut();
                    if (!error) {
                      navigate("/");
                    }
                  }}
                >
                  <LogOut className="h-5 w-5 text-primary-foreground group-hover:text-black" />
                  <span className={cn(isCollapsed && "sr-only", "text-primary-foreground group-hover:text-black")}>
                    Sign out
                  </span>
                </SidebarMenuButton>,
                "Sign out"
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
