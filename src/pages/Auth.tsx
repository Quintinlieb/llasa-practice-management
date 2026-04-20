import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import { readAuthFormDraft, writeAuthFormDraft } from "@/lib/authFormDraft";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);
  const [accountType, setAccountType] = useState<"trial" | "domestic" | "business" | null>(null);
  const [selectedAccountType, setSelectedAccountType] = useState<"trial" | "domestic" | "business" | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signUp, signIn, signOut, resetPassword, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const clearedSessionRef = useRef(false);

  useEffect(() => {
    const draft = readAuthFormDraft();
    if (!draft) return;
    const params = new URLSearchParams(location.search);
    const forceSignup = params.get("new") === "1";
    const forceLogin = params.get("login") === "1";
    if (forceSignup) {
      setIsLogin(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setAccountType(null);
      setSelectedAccountType(null);
      setAcceptedTerms(false);
      return;
    }

    if (!forceLogin) {
      setIsLogin(draft.isLogin);
    }

    if (forceLogin || draft.isLogin) {
      setEmail(draft.email);
      setPassword(draft.password);
      setConfirmPassword("");
      setAccountType(null);
      setSelectedAccountType(null);
      setAcceptedTerms(false);
      return;
    }

    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setAccountType(null);
    setSelectedAccountType(null);
    setAcceptedTerms(false);
  }, [location.search]);

  useEffect(() => {
    if (resetCooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldownSeconds]);

  useEffect(() => {
    writeAuthFormDraft({
      isLogin,
      email,
      password,
      confirmPassword,
      accountType,
      acceptedTerms,
    });
  }, [isLogin, email, password, confirmPassword, accountType, acceptedTerms]);

  // When starting a new auth flow, clear any existing session once.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromMarketing = params.get("new") === "1";
    const fromLogin = params.get("login") === "1";
    if (!fromMarketing && !fromLogin) return;
    setIsLogin(fromLogin);
    if (clearedSessionRef.current || loading) return;
    clearedSessionRef.current = true;
    if (user) {
      (async () => {
        await signOut();
      })();
    }
  }, [location.search, loading, user, signOut]);

  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      const params = new URLSearchParams(location.search);
      const fromMarketing = params.get("new") === "1";
      const fromLogin = params.get("login") === "1";
      // Skip auto-redirects while still unauthenticated when explicitly starting a new flow
      if ((fromMarketing || fromLogin) && !user) return;
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
    if (resetCooldownSeconds > 0) {
      toast({
        title: "Please wait",
        description: `Try again in ${resetCooldownSeconds}s.`,
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        const message = getSafeErrorMessage(error).toLowerCase();
        if (message.includes("rate limit")) {
          setResetCooldownSeconds(60);
          toast({
            title: "Too many reset attempts",
            description: "Please wait a minute and try again.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Error",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      } else {
        setResetCooldownSeconds(60);
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
    !!accountType &&
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    confirmPassword.trim().length > 0 &&
    acceptedTerms;
  const signupFieldClass =
    "h-[34px] rounded border-[1.75px] border-slate-300 bg-white text-[11px] font-medium text-slate-900 shadow-none placeholder:text-[10px] placeholder:text-slate-400 hover:border-blue-400 focus:border-blue-600 focus-visible:border-blue-600 ring-0 ring-offset-0 outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none";
  const accountTypeSelectTriggerClass =
    `${signupFieldClass} justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs data-[state=open]:border-blue-600 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 data-[state=open]:outline-none`;
  const accountTypeSelectContentClass = "!rounded";
  const accountTypeSelectItemClass =
    "!rounded text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";

  const authFormContent = (
    <div className="w-full max-w-md space-y-4">
      <div className="text-center space-y-3">
        <div className="mx-auto flex items-center justify-center">
          <img src="/zappir_thumbnail_blue.png" alt="Zappir thumbnail logo" className="h-12 w-12" />
        </div>
        <div className="space-y-1">
          <h1 className="text-[1.35rem] font-semibold text-foreground">
            {isLogin ? "Welcome back" : accountType ? "Create account" : "Choose account"}
          </h1>
          <p className="text-[0.8rem] text-muted-foreground">
            {isLogin ? "Go ahead and log in below" : accountType ? "Go ahead and fill out the form to get started." : "Select the account type that suit your needs and proceed."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pt-6 space-y-4" autoComplete={isLogin ? "on" : "off"}>
        {!isLogin && !accountType && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedAccountType("domestic")}
                aria-pressed={selectedAccountType === "domestic"}
                className={`group h-40 rounded-xl border bg-white p-4 text-left shadow-sm transition flex flex-col justify-between ${
                  selectedAccountType === "domestic"
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-500 hover:bg-blue-50/40"
                }`}
              >
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="mt-3 text-4xl font-semibold text-slate-900">Lite</p>
                  <div className="mt-3 w-16 border-t-2 border-blue-600" aria-hidden="true" />
                  <p className="mt-5 mb-3 text-xs text-slate-600">Ideal for startups and small businesses.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccountType("business")}
                aria-pressed={selectedAccountType === "business"}
                className={`group h-40 rounded-xl border bg-white p-4 text-left shadow-sm transition flex flex-col justify-between ${
                  selectedAccountType === "business"
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-500 hover:bg-blue-50/40"
                }`}
              >
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="mt-3 text-4xl font-semibold text-slate-900">Pro</p>
                  <div className="mt-3 w-16 border-t-2 border-blue-600" aria-hidden="true" />
                  <p className="mt-5 mb-3 text-xs text-slate-600">Best for established organisations from small to large.</p>
                </div>
              </button>
            </div>
            <div className="pt-6">
              <Button
                type="button"
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={!selectedAccountType}
                onClick={() => {
                  if (selectedAccountType) {
                    setAccountType(selectedAccountType);
                  }
                }}
              >
                Proceed
              </Button>
            </div>
          </div>
        )}

        {isLogin || accountType ? (
          <>
            {!isLogin && (
              <div className="group space-y-1">
                <Label htmlFor="accountType">Account type</Label>
                <Select
                  value={accountType ?? ""}
                  onValueChange={(value) => {
                    const nextValue = value as "domestic" | "business";
                    setAccountType(nextValue);
                    setSelectedAccountType(nextValue);
                  }}
                >
                  <SelectTrigger
                    id="accountType"
                    className={accountTypeSelectTriggerClass}
                  >
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent className={`w-[var(--radix-select-trigger-width)] ${accountTypeSelectContentClass}`}>
                    <SelectItem value="domestic" className={accountTypeSelectItemClass}>Lite</SelectItem>
                    <SelectItem value="business" className={accountTypeSelectItemClass}>Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="group space-y-1">
              <Label htmlFor="email">Username:</Label>
              <Input
                id="email"
                type="email"
                placeholder="Type your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete={isLogin ? "username" : "off"}
                required
                className={isLogin ? "h-11 group-hover:border-blue-600" : signupFieldClass}
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
                      <div className="invisible absolute right-0 top-full z-10 mt-2 w-56 rounded border border-blue-600 bg-background p-3 text-[11px] leading-relaxed opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
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
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    minLength={isLogin ? 6 : 8}
                    className={
                      isLogin
                        ? "h-11 pr-10 group-hover:border-blue-600"
                        : `${signupFieldClass} pr-10 ${passwordError ? "border-destructive hover:border-destructive focus:border-destructive focus-visible:border-destructive" : ""}`
                    }
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
                      disabled={isSendingReset || resetCooldownSeconds > 0}
                    >
                      {isSendingReset
                        ? "Sending..."
                        : resetCooldownSeconds > 0
                          ? `Try again in ${resetCooldownSeconds}s`
                          : "Forgot your password?"}
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
                        placeholder="Retype your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className={`${signupFieldClass} pr-10 ${confirmPasswordError ? "border-destructive hover:border-destructive focus:border-destructive focus-visible:border-destructive" : ""}`}
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
                    I have read, understood, and agree to the{" "}
                    <Link
                      to="/terms"
                      className="font-semibold text-inherit hover:text-blue-600 hover:underline"
                    >
                      Terms and Conditions
                    </Link>
                    .
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
          </>
        ) : null}
      </form>

      <div className="text-center text-xs text-muted-foreground">
        <button
          onClick={() => {
            if (isLogin) {
              navigate("/auth?new=1", { replace: true });
            } else {
              navigate("/auth?login=1", { replace: true });
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
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-[#3b4454]">
        <div className="mx-auto flex h-11 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center" aria-label="Go to website landing page">
            <img
              src="/zappir_logo_white&blue(1).png"
              alt="Zappir"
              className="h-6 w-auto"
            />
          </Link>
          <a href="mailto:support@zappir.co.za" className="group inline-flex items-center gap-1.5 text-xs text-slate-100 hover:text-white">
            <span>Support queries:</span>
            <Mail className="h-3.5 w-3.5" />
            <span className="group-hover:underline">support@zappir.co.za</span>
          </a>
        </div>
      </header>
      <main className="flex min-h-[calc(100vh-44px)] items-center justify-center px-6 py-12">
        <section className="w-full max-w-md px-2 py-2">
          {authFormContent}
        </section>
      </main>
    </div>
  );
};

export default Auth;

