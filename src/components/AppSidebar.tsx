import { FileText, Users, Home, LogOut } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type FocusEvent } from "react";
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
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { documentCategories } from "@/constants/documentCategories";

interface Profile {
  user_name: string;
  user_surname: string;
  user_email: string;
}

const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Employees", url: "/employees", icon: Users },
];

export const isActiveCategory = (pathname: string, slug: string) =>
  pathname.startsWith(`/documents/${slug}`);

export const isAnyDocsChildActive = (pathname: string) =>
  documentCategories.some((category) => isActiveCategory(pathname, category.slug));

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDocsMenuInteracting, setIsDocsMenuInteracting] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("user_name, user_surname, user_email")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  const getInitials = () => {
    if (!profile) return "U";
    return `${profile.user_name.charAt(0)}${profile.user_surname.charAt(0)}`.toUpperCase();
  };

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

  return (
    <Sidebar collapsible="none" className="w-56 h-screen border-r border-sidebar-border">
      <SidebarHeader className="px-2 py-2">
        <div className="h-14 w-full overflow-hidden flex items-center justify-center">
          <img
            src="/logo.png.png"
            alt="logo"
            className="h-[85%] w-auto object-contain"
            style={{ imageRendering: "crisp-edges" }}
          />
        </div>
        <SidebarSeparator className="mt-2" />
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarGroup className="pt-10">
          <SidebarGroupLabel className="mt-1">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    className={
                      location.pathname === item.url
                        ? "!bg-transparent text-primary hover:text-primary data-[active=true]:!bg-transparent [&>svg]:text-primary"
                        : ""
                    }
                  >
                    <NavLink
                      to={item.url}
                      className="w-full"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
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
                  <SidebarMenuButton
                    type="button"
                    id="documents-menu-button"
                    aria-expanded={isDocsOpen}
                    aria-controls="documents-menu"
                    aria-haspopup="true"
                    isActive={docsCategoryActive}
                    className={cn(
                      "!bg-transparent w-full",
                      docsCategoryActive ? "font-semibold text-foreground" : ""
                    )}
                  >
                    <FileText
                      className={cn(
                        "h-4 w-4 text-current",
                        docsCategoryActive && "text-blue-600"
                      )}
                    />
                    <span>Documents</span>
                  </SidebarMenuButton>
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
                        className="flex flex-col gap-[0.11rem] px-[0.63rem] py-[0.32rem]"
                      >
                        {documentCategories.map((category) => {
                          const active = isActiveCategory(pathname, category.slug);
                          return (
                            <li key={category.slug}>
                              <NavLink
                                to={`/documents/${category.slug}`}
                                role="menuitem"
                                className={cn(
                                  "block rounded-md pl-[1.22rem] pr-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                  active
                                    ? "font-medium text-blue-600"
                                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {category.label}
                              </NavLink>
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

      <SidebarFooter className="p-4 sticky bottom-0 bg-sidebar">
        <div className="mb-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-primary hover:text-accent-foreground [&>svg]:text-current"
            onClick={async () => {
              const { error } = await signOut();
              if (!error) {
                navigate("/");
              }
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
        <SidebarSeparator className="mt-2" />
        {profile && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile.user_name} {profile.user_surname}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile.user_email}
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
