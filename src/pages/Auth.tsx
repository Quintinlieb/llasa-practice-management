import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Eye, EyeOff, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getSafeErrorMessage } from "@/lib/errorHandling";

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
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [accountType, setAccountType] = useState<"trial" | "domestic" | "business">("domestic");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signUp, signIn, signOut, resetPassword, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // If coming from marketing CTAs with ?new=1, default to Sign Up view and ensure no existing session persists
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromMarketing = params.get("new") === "1";
    const fromLogin = params.get("login") === "1";
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
    const params = new URLSearchParams(location.search);
    const fromLogin = params.get("login") === "1";
    if (!fromLogin) return;
    setIsLogin(true);
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
      const fromLogin = params.get("login") === "1";
      // Skip auto-redirects when explicitly starting a new flow from marketing
      if (fromMarketing || fromLogin) return;
      if (!loading && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          if (location.pathname !== "/dashboard") navigate("/dashboard");
        } else {
          if (location.pathname !== "/account-setup") navigate("/account-setup");
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
            description: getSafeErrorMessage(error),
            variant: "destructive",
          });
        }
      } else {
        const { data, error } = await signUp(email, password, accountType);
        if (error) {
          toast({
            title: "Error",
            description: getSafeErrorMessage(error),
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter your account email to get a reset link.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast({
          title: "Error",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset link sent",
          description: "Check your inbox for password reset instructions.",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const isSignupReady =
    !isLogin &&
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    confirmPassword.trim().length > 0 &&
    acceptedTerms;

  return (
    <div className="min-h-screen bg-black">
      <div className="min-h-screen grid lg:grid-cols-2">
        <section className="relative hidden lg:flex">
          <div className="absolute inset-0 bg-black">
            <img
              src="/AuthImage.png"
              alt="Team collaborating"
              className="h-full w-full object-cover opacity-[0.28]"
              style={{ objectPosition: "20% center" }}
            />
          </div>
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-14 text-white">
            <img src="/mainlogo2.png" alt="Hure Systems" className="mx-auto h-auto w-64" />
            <p className="mt-10 max-w-lg text-center text-[0.8125rem] text-white/80">
              {isLogin
                ? "Welcome back to Nudoc\u2122. A secure and reliable platform that simplifies the drafting and storage of your most important HR documents."
                : "Welcome to Nudoc\u2122. A secure and reliable platform that simplifies the drafting and storage of your most important HR documents."}
            </p>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-white px-6 py-12 sm:px-10">
          <div className="absolute right-6 top-6">
            <Link
              to="/"
              aria-label="Close and return home"
              tabIndex={-1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-blue-600 hover:ring-1 hover:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>

          <div className="w-full max-w-md space-y-4">
            <div className="text-center space-y-3">
              <div className="mx-auto flex items-center justify-center">
                <img src="/thumbnail-logo.svg" alt="thumbnail logo" className="h-12 w-12" />
              </div>
              <div className="space-y-1">
                <h1 className="text-[1.35rem] font-semibold text-foreground">
                  {isLogin ? "Welcome back" : "Create account"}
                </h1>
                <p className="text-[0.8rem] text-muted-foreground">
                  {isLogin ? "Go ahead and log in below" : "Choose your account type and fill out the form to get started."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="pt-6 space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <button
                      type="button"
                      onClick={() => setAccountType("domestic")}
                      aria-pressed={accountType === "domestic"}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        accountType === "domestic"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Domestic
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("business")}
                      aria-pressed={accountType === "business"}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        accountType === "business"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="email">Username:</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Type your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password:</Label>
                    {!isLogin && (
                      <div className="relative group inline-flex items-center gap-2 cursor-help text-[11px] text-muted-foreground">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">Password requirements</span>
                        <div className="invisible absolute right-0 top-full z-10 mt-2 w-56 rounded-md border border-blue-600 bg-background p-3 text-[11px] leading-relaxed opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                          <p className="mb-1 font-medium text-blue-600">Include:</p>
                          <ul className="space-y-0.5 list-disc list-inside">
                            <li>At least 8 characters</li>
                            <li>One uppercase letter</li>
                            <li>One lowercase letter</li>
                            <li>One number</li>
                            <li>One special character</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="group relative pb-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Type your password"
                      value={password}
                      onChange={handlePasswordChange}
                      required
                      minLength={isLogin ? 6 : 8}
                      className={passwordError && !isLogin ? "h-11 border-destructive pr-10 group-hover:border-blue-600" : "h-11 pr-10 group-hover:border-blue-600"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isLogin && (
                    <div className="mt-2 flex justify-start">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        tabIndex={-1}
                        className="text-[11px] font-normal text-muted-foreground underline hover:text-blue-600 disabled:opacity-60"
                        disabled={isSendingReset}
                      >
                        {isSendingReset ? "Sending..." : "Forgot your password?"}
                      </button>
                    </div>
                  )}
                  {!isLogin && passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>
              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="group relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className={confirmPasswordError ? "h-11 border-destructive pr-10 group-hover:border-blue-600" : "h-11 pr-10 group-hover:border-blue-600"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
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
              {!isLogin && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    required
                    className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground">
                    I have read and agree to the{" "}
                    <a
                      href="/terms"
                      className="font-semibold text-inherit hover:text-blue-600 hover:underline"
                    >
                      Terms & Conditions
                    </a>
                  </label>
                </div>
              )}
            </div>
            <div className="pt-6">
              <Button
                type="submit"
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={isLoading || (isLogin ? false : !isSignupReady)}
              >
                  {isLoading ? "Please wait..." : isLogin ? "Sign in" : "Sign up"}
                </Button>
              </div>
            </form>

            <div className="text-center text-xs text-muted-foreground">
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
                className="text-muted-foreground hover:text-blue-600 hover:underline"
              >
                {isLogin ? (
                  <>
                    Don't have an account? <span className="font-semibold">Sign up</span>
                  </>
                ) : (
                  <>
                    Already have an account? <span className="font-semibold">Sign in</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Auth;

