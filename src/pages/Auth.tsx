import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Info, Eye, EyeOff, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signIn, signOut, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // If coming from marketing CTAs with ?new=1, default to Sign Up view and ensure no existing session persists
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromMarketing = params.get("new") === "1";
    if (!fromMarketing) return;
    setIsLogin(false);
    // Ensure we are fully signed out before continuing, so we don't auto-redirect away
    (async () => {
      if (!loading && user) {
        await signOut();
      }
    })();
  }, [location.search, loading, user, signOut]);

  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      const params = new URLSearchParams(location.search);
      const fromMarketing = params.get("new") === "1";
      // Skip auto-redirects when explicitly starting a new flow from marketing
      if (fromMarketing) return;
      if (!loading && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          if (location.pathname !== "/dashboard") navigate("/dashboard");
        } else {
          if (location.pathname !== "/company-setup") navigate("/company-setup");
        }
      }
    };

    checkProfileAndRedirect();
  }, [user, loading, navigate, location.pathname]);

  const validatePassword = (pwd: string): boolean => {
    if (isLogin) return true; // Skip validation for login
    
    try {
      passwordSchema.parse(pwd);
      setPasswordError("");
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordError(error.errors[0].message);
      }
      return false;
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (!isLogin) {
      validatePassword(newPassword);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setConfirmPasswordError("");
    
    // Validate password for signup
    if (!isLogin && !validatePassword(password)) {
      return;
    }
    
    // Validate password confirmation
    if (!isLogin && password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        const { data, error } = await signUp(email, password);
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } else {
          if (data?.session) {
            await signOut();
          }
          toast({
            title: "Success",
            description: "Account created! Please confirm your email and then sign in.",
          });
          setIsLogin(true);
          setPassword("");
          setConfirmPassword("");
          navigate("/auth", { replace: true });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="w-full max-w-md px-6">
        <div className="flex justify-end mb-3">
          <Link
            to="/"
            aria-label="Close and return home"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-muted-foreground transition hover:text-blue-600 hover:font-semibold hover:ring-1 hover:ring-blue-500"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
        <Card className="w-full shadow-xl">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center mb-2">
              <img src="/nudoc_icon.png" alt="nudoc logo" className="h-12 w-auto object-cover" />
            </div>
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "Sign in to access your HR documents" : "Fill out the form below and get started today"}
            </CardDescription>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  minLength={isLogin ? 6 : 8}
                  className={passwordError && !isLogin ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!isLogin && (
                <div className="flex items-start justify-between text-xs text-muted-foreground">
                  <div className="relative group inline-flex items-center gap-2 cursor-help">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="font-medium">Password requirements</span>
                    <div className="invisible absolute left-0 top-full z-10 mt-2 w-56 rounded-md border border-border bg-background p-3 text-xs leading-relaxed opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                      <p className="mb-1 font-medium">Include:</p>
                      <ul className="space-y-0.5 list-disc list-inside">
                        <li>At least 8 characters</li>
                        <li>One uppercase letter</li>
                        <li>One lowercase letter</li>
                        <li>One number</li>
                        <li>One special character</li>
                      </ul>
                    </div>
                  </div>
                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>
              )}
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className={confirmPasswordError ? "border-destructive pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPasswordError && (
                  <p className="text-sm text-destructive">{confirmPasswordError}</p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => {
                const toSignup = isLogin;
                setIsLogin(!isLogin);
                if (toSignup) {
                  navigate("/auth?new=1", { replace: true });
                } else {
                  navigate("/auth", { replace: true });
                }
              }}
              className="text-primary hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Auth;
