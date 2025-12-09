import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, LogOut, Bell } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface Profile {
  user_name: string;
  user_surname: string;
  user_email: string;
}

const STORAGE_KEYS = {
  COMPANY: "header:companyName",
  PROFILE: "header:profile",
} as const;

const getStoredProfile = (): Profile | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.PROFILE);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.COMPANY) || "";
    } catch {
      return "";
    }
  });
  const [profile, setProfile] = useState<Profile | null>(() => getStoredProfile());



  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("company_name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCompanyName(data.company_name);
        });
      supabase
        .from("profiles")
        .select("user_name, user_surname, user_email")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data as Profile);
        });
    }
  }, [user]);

  useEffect(() => {
    try {
      if (companyName) {
        sessionStorage.setItem(STORAGE_KEYS.COMPANY, companyName);
      }
      if (profile) {
        sessionStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      }
    } catch {
      // ignore storage errors
    }
  }, [companyName, profile]);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-screen flex bg-[#eef2f7]">
        <div className="flex-shrink-0 h-screen sticky top-0 p-4 overflow-y-auto">
          <AppSidebar profile={profile || undefined} />
        </div>
        <div className="flex flex-1 min-h-screen flex-col bg-[#eef2f7]">
          <header className="sticky top-0 z-40 pr-4 pl-0 pt-4 pb-0 bg-[#eef2f7]">
            <div className="relative w-full rounded-2xl border border-sidebar-border bg-white shadow-md px-6 py-3 flex items-center justify-between">
              <div className="flex items-center">
                {companyName && (
                  <h1 className="text-lg font-semibold">{companyName}</h1>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10">
                      <Bell className="h-5 w-5 text-primary" />
                      <span className="sr-only">Notifications</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Notifications</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-primary/10"
                      onClick={() => navigate("/settings")}
                    >
                      <Settings className="h-5 w-5 text-primary" />
                      <span className="sr-only">Settings</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Settings</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-primary/10"
                      onClick={async () => {
                        const { error } = await signOut();
                        if (!error) {
                          navigate("/");
                        }
                      }}
                    >
                      <LogOut className="h-5 w-5 text-primary" />
                      <span className="sr-only">Sign out</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Sign out</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </header>

          <div className="flex-1 min-w-0 flex flex-col bg-[#eef2f7]">
            <main className="flex-1 w-full p-6">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
