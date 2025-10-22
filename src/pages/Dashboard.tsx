import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
const Dashboard = () => {
  const {
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    employees: 0,
    documents: 0
  });
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Check if profile exists
      const {
        data: profileData
      } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!profileData) {
        navigate("/company-setup");
        return;
      }
      setProfile(profileData);

      // Fetch statistics
      const {
        count: employeeCount
      } = await supabase.from("employees").select("*", {
        count: "exact",
        head: true
      }).eq("company_id", user.id);
      const {
        count: documentCount
      } = await supabase.from("documents").select("*", {
        count: "exact",
        head: true
      }).eq("company_id", user.id);
      setStats({
        employees: employeeCount || 0,
        documents: documentCount || 0
      });
    };
    fetchData();
  }, [user, navigate]);
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>;
  }
  return <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back{profile ? `, ${profile.user_name}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Manage your HR documents and employees
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.employees}</p>
              <p className="text-sm text-muted-foreground mt-1">Total registered</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.documents}</p>
              <p className="text-sm text-muted-foreground mt-1">Warnings generated</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Quick Actions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="shadow-md hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate("/warning-generator")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Generate Written Warning
                </CardTitle>
                <CardDescription>Create a new written warning for an employee</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full group-hover:scale-105 transition-transform">
                  Start Now
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate("/employees")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Manage Employees
                </CardTitle>
                <CardDescription>Add or edit your employee list</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full group-hover:scale-105 transition-transform">
                  View Employees
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>;
};

export default Dashboard;