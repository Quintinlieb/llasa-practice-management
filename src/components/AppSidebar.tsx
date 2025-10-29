import { FileText, Users, Home, LogOut } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
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
  useSidebar,
  SidebarSeparator,
} from "@/components/ui/sidebar";

interface Profile {
  user_name: string;
  user_surname: string;
  user_email: string;
}

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "New Warning", url: "/warning-generator", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);

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

  return (
    <Sidebar collapsible="icon" className={state === "collapsed" ? "w-14" : "w-60"}>
      <SidebarHeader className="px-2 py-2">
        {state !== "collapsed" && (
          <div className="h-14 w-full overflow-hidden flex items-center justify-center">
            <img src="/logo.png.png" alt="logo" className="h-full w-auto object-cover" style={{ imageRendering: 'crisp-edges' }} />
          </div>
        )}
        {state === "collapsed" && (
          <div className="h-14 w-full overflow-hidden flex items-center justify-center">
            <img src="/nudoc_icon.png" alt="logo" className="h-full w-auto object-cover" style={{ imageRendering: 'crisp-edges' }} />
          </div>
        )}
        <SidebarSeparator className="mt-2" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-10">
          <SidebarGroupLabel className="mt-1">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={async () => {
              const { error } = await signOut();
              if (!error) {
                navigate("/");
              }
            }}
          >
            <LogOut className="h-4 w-4" />
            {state !== "collapsed" && <span>Sign Out</span>}
          </Button>
        </div>
        {profile && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              {getInitials()}
            </div>
            {state !== "collapsed" && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.user_name} {profile.user_surname}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile.user_email}
                </p>
              </div>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
