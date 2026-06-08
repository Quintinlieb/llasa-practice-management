import {
  Building2,
  FolderOpen,
  Users,
  Home,
  LogOut,
  BriefcaseBusiness,
  CalendarDays,
  LayoutTemplate,
  ChartColumn,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { type ReactElement } from "react";
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
import { prefetchDashboardWeeklySchedule } from "@/lib/dashboardWeeklyMatters";

const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Clients", url: "/clients-2", icon: Building2 },
  { title: "Matters", url: "/case-files", icon: BriefcaseBusiness },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Templates", icon: LayoutTemplate },
  { title: "Reports", icon: ChartColumn },
  { title: "Team", icon: Users },
];

type AppSidebarProps = {
  isCollapsed: boolean;
};

export function AppSidebar({ isCollapsed }: AppSidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleDashboardIntent = () => {
    void prefetchDashboardWeeklySchedule().catch(() => {
      // Dashboard will retry normally if the hover prefetch fails.
    });
  };

  const withTooltip = (element: ReactElement, label: string) =>
    isCollapsed ? (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{element}</TooltipTrigger>
          <TooltipContent side="right" className="rounded border border-[#3eca44]/35 shadow-[0_0_0_1px_rgba(62,202,68,0.2),0_10px_28px_rgba(62,202,68,0.28)]">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      element
    );

  return (
    <Sidebar
      collapsible="none"
      className={cn(
        "relative h-full w-full flex flex-col bg-[#2D4256] text-white shadow-sm overflow-visible transition-[width] duration-200",
      )}
    >
      <div className="flex h-full flex-col overflow-x-visible overflow-y-hidden">
        <div
          className={cn(
            "relative flex items-center pt-4 pb-2 mb-4 h-16 overflow-hidden transition-[padding] duration-200 ease-linear",
            isCollapsed ? "px-2 justify-center" : "px-4 justify-start",
          )}
        >
          <div className="absolute left-10 top-[55%] -translate-x-1/2 -translate-y-1/2">
            <img
              src="/llasa_thumbnail.png"
              alt="LLASA thumbnail logo"
              className="h-7 w-auto shrink-0 object-contain"
            />
          </div>
          <span
            aria-hidden={isCollapsed}
            className="absolute top-[55%] overflow-hidden whitespace-nowrap text-[24px] font-bold tracking-[0.08em] text-white -translate-y-1/2"
            style={{
              left: "3.95rem",
              width: isCollapsed ? "0ch" : "5.8ch",
              fontFamily: '"Barlow", "Inter", sans-serif',
              transition: "width 200ms steps(5, end)",
            }}
          >
            LLASA
          </span>
        </div>
        <SidebarContent className="px-0">
          <SidebarGroup className="pt-2 px-0">
            <SidebarGroupLabel className="mt-0 w-full pl-[22px] text-left text-white/70">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {primaryNavItems.map((item) => {
                  const isActive = item.url
                    ? item.url === "/documents"
                      ? pathname.startsWith("/documents")
                      : item.url === "/case-files"
                        ? pathname.startsWith("/case-files")
                        : location.pathname === item.url
                    : false;
                  return (
                    <SidebarMenuItem key={item.title}>
                      {withTooltip(
                        <div className="relative">
                          {isActive ? (
                            <>
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute -top-2 right-0 z-10 block h-2 w-2 rounded-br-full shadow-[4px_4px_0_4px_#ffffff]"
                              />
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute -bottom-2 right-0 z-10 block h-2 w-2 rounded-tr-full shadow-[4px_-4px_0_4px_#ffffff]"
                              />
                            </>
                          ) : null}
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "rounded-none px-7 !py-[21px] text-[13.33px] active:bg-transparent active:text-inherit data-[active=true]:text-white",
                              !isActive && "transition-all duration-150",
                              !isActive && "text-white/70 hover:bg-transparent hover:text-white",
                              isActive &&
                                "bg-white text-[#2D4256] border-r-0 active:!bg-white active:!text-[#2D4256] data-[active=true]:!bg-white data-[active=true]:!text-[#2D4256]",
                            )}
                            data-collapsed={isCollapsed}
                          >
                            {item.url ? (
                              <NavLink
                                to={item.url}
                                className="group flex w-full items-center gap-2 text-[13.33px]"
                                onFocus={item.url === "/dashboard" ? handleDashboardIntent : undefined}
                                onMouseEnter={item.url === "/dashboard" ? handleDashboardIntent : undefined}
                              >
                                <span
                                  className={cn(
                                    "flex items-center gap-2",
                                    !isActive && "group-hover:translate-x-[3px]",
                                  )}
                                >
                                  <item.icon
                                    className={cn(
                                      "h-5 w-5",
                                      isActive ? "text-[#3eca44]" : "text-white/70 group-hover:text-white",
                                    )}
                                  />
                                  <span className={cn(isCollapsed && "sr-only", !isActive && "text-white/70 group-hover:text-white", isActive && "text-[13.83px] font-semibold")}>{item.title}</span>
                                </span>
                              </NavLink>
                            ) : (
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2 text-left text-[13.33px]"
                              >
                                <span className="flex items-center gap-2 group-hover:translate-x-[3px]">
                                  <item.icon className={cn("h-5 w-5", isActive ? "text-[#3eca44]" : "text-white/70 group-hover:text-white")} />
                                  <span className={cn(isCollapsed && "sr-only", !isActive && "text-white/70 group-hover:text-white", isActive && "text-[13.83px] font-semibold")}>{item.title}</span>
                                </span>
                              </button>
                            )}
                          </SidebarMenuButton>
                        </div>,
                        item.title
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-0 py-4 border-t border-white/10">
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "group rounded-none px-7 !py-[21px] text-[13.33px] text-white underline underline-offset-4 decoration-white transition-all duration-150 hover:bg-[#010D1A] [&>span]:transition-colors [&>span]:duration-150 [&>svg]:transition-colors [&>svg]:duration-150",
                  )}
                  data-collapsed={isCollapsed}
                  onClick={async () => {
                    await signOut();
                    navigate("/auth?login=1", { replace: true });
                  }}
                >
                  <LogOut className="h-5 w-5 text-white" />
                  <span className={cn(isCollapsed && "sr-only", "text-white !underline underline-offset-4 decoration-white")}>
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
