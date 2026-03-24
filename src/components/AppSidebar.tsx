import { FolderOpen, Users, Home, Headset, Bell, Settings, LogOut, Bot } from "lucide-react";
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

const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Assistant", url: "/assistant", icon: Bot },
];

type AppSidebarProps = {
  isCollapsed: boolean;
};

export function AppSidebar({ isCollapsed }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const withTooltip = (element: ReactElement, label: string) =>
    isCollapsed ? (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{element}</TooltipTrigger>
          <TooltipContent side="right" className="rounded drop-shadow-md">
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
        "relative h-full w-full flex flex-col bg-[#2D4256] text-white shadow-sm overflow-visible transition-[width] duration-200",
      )}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div
          className={cn(
            "relative flex items-center pt-4 pb-2 mb-4 h-16 overflow-hidden transition-[padding] duration-200 ease-linear",
            isCollapsed ? "px-2 justify-center" : "px-4 justify-start",
          )}
        >
          {!isCollapsed && (
            <img
              src="/zappir_logo_white&blue(1).png"
              alt="logo"
              className="absolute left-6 top-[53%] h-6 w-auto -translate-y-1/2 object-contain"
              style={{ imageRendering: "crisp-edges" }}
            />
          )}
          {isCollapsed && (
            <img
              src="/zappir_thumbnail_blue.png"
              alt="logo"
              className="absolute left-10 top-[55%] h-6 w-auto -translate-x-1/2 -translate-y-1/2 object-contain"
              style={{ imageRendering: "crisp-edges" }}
            />
          )}
        </div>
        <SidebarContent className="px-0">
          <SidebarGroup className="pt-2 px-0">
            <SidebarGroupLabel className="mt-0 w-full pl-[22px] text-left text-white/70">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {primaryNavItems.map((item) => {
                  const isActive =
                    item.url === "/documents"
                      ? pathname.startsWith("/documents")
                      : location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      {withTooltip(
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                            isActive &&
                              "bg-[#010D1A] text-white border-b-2 border-blue-500 data-[active=true]:!bg-[#010D1A] [&>svg]:text-white",
                          )}
                          data-collapsed={isCollapsed}
                        >
                          <NavLink
                            to={item.url}
                            className="w-full text-xs"
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

        <SidebarFooter className="px-0 py-4 mt-auto border-t border-white/10">
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                    location.pathname === "/settings" &&
                      "bg-[#010D1A] text-white border-b-2 border-blue-500 data-[active=true]:!bg-[#010D1A] [&>svg]:text-white",
                  )}
                  isActive={location.pathname === "/settings"}
                  data-collapsed={isCollapsed}
                >
                  <NavLink to="/settings" state={{ backgroundLocation: location }} className="w-full text-xs">
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
                    "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
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
                    "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
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
                    "group rounded-none px-7 !py-5 text-xs text-white underline underline-offset-4 decoration-white transition-all duration-150 hover:bg-[#010D1A] [&>span]:transition-colors [&>span]:duration-150 [&>svg]:transition-colors [&>svg]:duration-150",
                  )}
                  data-collapsed={isCollapsed}
                  onClick={async () => {
                    const { error } = await signOut();
                    if (!error) {
                      navigate("/");
                    }
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
