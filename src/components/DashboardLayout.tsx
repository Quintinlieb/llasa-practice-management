import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const { toast } = useToast();

  

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
    }
  }, [user]);

  

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="sticky top-0 h-screen flex-shrink-0">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#f5f7fa]">
          <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-40 h-14">
            <div className="relative h-full px-6 flex items-center justify-between">
              <div className="flex items-center">
                {companyName && (
                  <h1 className="text-lg font-semibold">{companyName}</h1>
                )}
              </div>
              <Link to="/settings">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
