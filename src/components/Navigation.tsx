import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, LogOut, Users, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const Navigation = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.svg" alt="nudoc logo" className="h-6 w-6" />
            <span className="font-bold text-xl">nudoc</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link to="/dashboard">
              <Button 
                variant={isActive("/dashboard") ? "secondary" : "ghost"} 
                size="sm"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link to="/employees">
              <Button 
                variant={isActive("/employees") ? "secondary" : "ghost"} 
                size="sm"
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Employees
              </Button>
            </Link>
            <Link to="/warning-generator">
              <Button 
                variant={isActive("/warning-generator") ? "secondary" : "ghost"} 
                size="sm"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                New Warning
              </Button>
            </Link>
            <Link to="/documents/contracts/permanent">
              <Button 
                variant={isActive("/documents/contracts/permanent") ? "secondary" : "ghost"} 
                size="sm"
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                New Contract
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="gap-2 ml-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
