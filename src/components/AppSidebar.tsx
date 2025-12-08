import { FileText, Users, Home, CalendarClock, ArrowLeft, Gavel, LineChart, FileSignature, AlertTriangle } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, type FocusEvent, type ComponentType, ReactElement } from "react";
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
import { documentCategories } from "@/constants/documentCategories";

const SIDEBAR_COLLAPSED_KEY = "sidebar:collapsed";
type SidebarProfile = {
  user_name: string;
  user_surname: string;
  user_email: string;
};

const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Calendar", url: "/calendar", icon: CalendarClock },
];

export const isActiveCategory = (pathname: string, slug: string) =>
  pathname.startsWith(`/documents/${slug}`);

export const isAnyDocsChildActive = (pathname: string) =>
  documentCategories.some((category) => isActiveCategory(pathname, category.slug));

const documentCategoryIcons: Record<string, ComponentType<{ className?: string }>> = {
  discipline: Gavel,
  performance: LineChart,
  contracts: FileSignature,
  notices: AlertTriangle,
};

export function AppSidebar({ profile }: { profile?: SidebarProfile }) {
  const location = useLocation();
  const [isDocsMenuInteracting, setIsDocsMenuInteracting] = useState(false);
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
  const docsCategoryActive = isAnyDocsChildActive(pathname);
  const isDocsOpen = docsCategoryActive || isDocsMenuInteracting;

  const handleDocsMouseEnter = () => setIsDocsMenuInteracting(true);

  const handleDocsMouseLeave = () => {
    if (!docsCategoryActive) {
      setIsDocsMenuInteracting(false);
    }
  };

  const handleDocsFocus = () => setIsDocsMenuInteracting(true);

  const handleDocsBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (docsCategoryActive) return;
    const nextFocusTarget = event.relatedTarget as Node | null;
    if (nextFocusTarget && event.currentTarget.contains(nextFocusTarget)) {
      return;
    }
    setIsDocsMenuInteracting(false);
  };

  const documentsActive = docsCategoryActive;
  const initials =
    profile?.user_name && profile?.user_surname
      ? `${profile.user_name.charAt(0)}${profile.user_surname.charAt(0)}`.toUpperCase()
      : "U";

  return (
    <Sidebar
      collapsible="none"
      className={cn(
        "relative h-full flex flex-col bg-white border border-sidebar-border shadow-md rounded-2xl overflow-visible transition-[width] duration-200",
        isCollapsed ? "w-16" : "w-52",
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
      <div className="flex h-full flex-col rounded-2xl overflow-hidden bg-white">
        <div className={cn("flex items-center justify-center pt-4 pb-2 mb-4 h-16", isCollapsed ? "px-2" : "px-4")}>
          <img
            src={isCollapsed ? "/thumbnail-logo.svg" : "/logo.png.png"}
            alt="logo"
            className={cn(isCollapsed ? "h-8" : "h-10", "w-auto object-contain")}
            style={{ imageRendering: "crisp-edges" }}
          />
        </div>
        <SidebarContent className={cn("px-4", isCollapsed && "px-2")}>
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className={cn("mt-0 w-full text-center", isCollapsed && "transform -translate-x-2.5")}>
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {primaryNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {withTooltip(
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.url}
                        className={cn(
                          "rounded-xl border border-transparent transition-all duration-150 hover:border-primary/10 hover:bg-primary/5",
                          location.pathname === item.url &&
                            "bg-primary/10 text-primary border-primary/20 shadow-[0_10px_25px_-15px_hsla(var(--primary),0.6)] data-[active=true]:!bg-primary/10 [&>svg]:text-primary",
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
                ))}
                <SidebarMenuItem>
                  <div
                    className="group relative w-full"
                    onMouseEnter={handleDocsMouseEnter}
                    onMouseLeave={handleDocsMouseLeave}
                    onFocus={handleDocsFocus}
                    onBlur={handleDocsBlur}
                    >
                    {withTooltip(
                      <SidebarMenuButton
                        type="button"
                        id="documents-menu-button"
                        aria-expanded={isDocsOpen}
                        aria-controls="documents-menu"
                        aria-haspopup="true"
                        isActive={documentsActive}
                        className={cn(
                          "w-full rounded-xl border border-transparent transition-all duration-150 hover:border-primary/10 hover:bg-primary/5",
                          isCollapsed && "justify-center",
                          documentsActive &&
                            "bg-primary/10 text-primary border-primary/20 font-semibold shadow-[0_10px_25px_-15px_hsla(var(--primary),0.6)] data-[active=true]:!bg-primary/10"
                        )}
                        data-collapsed={isCollapsed}
                      >
                        <FileText
                          className={cn(
                            "h-5 w-5 text-current",
                            documentsActive && "text-primary"
                          )}
                        />
                        <span className={cn(isCollapsed && "sr-only")}>Documents</span>
                      </SidebarMenuButton>,
                      "Documents"
                    )}
                    <div
                      id="documents-menu"
                      role="presentation"
                      className={cn(
                        "mt-[0.21rem] overflow-hidden rounded-md bg-white/80 shadow-sm transition-all duration-150 ease-out",
                        "max-h-0 opacity-0 group-hover:max-h-screen group-hover:opacity-100",
                        isDocsOpen && "max-h-screen opacity-100"
                      )}
                    >
                      <nav aria-label="Document categories">
                        <ul
                          role="menu"
                          aria-labelledby="documents-menu-button"
                          className={cn(
                            "flex flex-col gap-[0.11rem] py-[0.32rem]",
                            isCollapsed ? "px-0 items-center" : "px-[0.63rem]"
                          )}
                        >
                          {documentCategories.map((category) => {
                            const active = isActiveCategory(pathname, category.slug);
                            const CategoryIcon = documentCategoryIcons[category.slug] || FileText;
                            return (
                              <li key={category.slug}>
                                {withTooltip(
                                  <NavLink
                                    to={`/documents/${category.slug}`}
                                    role="menuitem"
                                    className={cn(
                                      "flex items-center rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                      isCollapsed ? "justify-center gap-0 px-0 py-2 ml-1" : "gap-2 pl-[1.22rem] pr-4 py-2",
                                      active
                                        ? "font-semibold text-primary"
                                        : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                                    )}
                                  >
                                    <CategoryIcon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                                    <span className={cn(isCollapsed && "sr-only")}>{category.label}</span>
                                  </NavLink>,
                                  category.label
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </nav>
                    </div>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 bg-sidebar mt-auto border-t border-sidebar-border/70">
          {profile && (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="leading-tight min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Welcome,</p>
                  <p className="text-sm font-semibold truncate">
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
