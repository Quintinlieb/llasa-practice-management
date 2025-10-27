import { FileText, Users, Settings, Home } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
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
  const { user } = useAuth();
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
      <SidebarHeader className="px-2 py-0">
        {state !== "collapsed" && (
          <div className="flex items-start justify-center gap-0">
            <img src="/logo.png.png" alt="logo" className="h-36 w-36 object-contain" style={{imageRendering: 'crisp-edges'}} />
          </div>
        )}
        {state === "collapsed" && (
          <img src="/nudoc_icon.png" alt="logo" className="h-36 w-36 mx-auto object-contain" style={{imageRendering: 'crisp-edges'}} />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                      }
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                    }
                  >
                    <Settings className="h-4 w-4" />
                    {state !== "collapsed" && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
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
