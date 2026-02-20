import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Eye, EyeOff, X, Home, Building2, Mail } from "lucide-react";
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
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
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
    if (!forceSignup && !forceLogin) {
      setIsLogin(draft.isLogin);
    }
    setEmail(draft.email);
    setPassword(draft.password);
    setConfirmPassword(draft.confirmPassword);
    setAccountType(draft.accountType);
    setSelectedAccountType(draft.accountType);
    setAcceptedTerms(draft.acceptedTerms);
  }, [location.search]);

  useEffect(() => {
    const img = new Image();
    img.src = "/AuthImage.png";
    img.onload = () => setHeroLoaded(true);
    img.onerror = () => setHeroLoaded(true);
  }, []);

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
    !!accountType &&
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    confirmPassword.trim().length > 0 &&
    acceptedTerms;

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

      <form onSubmit={handleSubmit} className="pt-6 space-y-4">
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
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <Home className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">Domestic</p>
                  <p className="mt-1 text-xs text-slate-600">Ideal for private households.</p>
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
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <Building2 className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">Business</p>
                  <p className="mt-1 text-xs text-slate-600">Best for corporate companies.</p>
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
                    className="h-11 group-hover:border-blue-600"
                  >
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domestic">Domestic</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
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
                required
                className="h-11 group-hover:border-blue-600"
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

  if (isLogin) {
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
            <a href="mailto:support@zappir.co.za" className="inline-flex items-center gap-1.5 text-xs text-slate-100 hover:text-white">
              <span>Support queries:</span>
              <Mail className="h-3.5 w-3.5" />
              support@zappir.co.za
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
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="min-h-screen grid lg:grid-cols-2">
        <section className="relative hidden lg:flex">
          <div className="absolute inset-0 bg-black">
            <img
              src="/AuthImage.png"
              alt="Team collaborating"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setHeroLoaded(true)}
              onError={() => setHeroLoaded(true)}
              className={`h-full w-full object-cover opacity-[0.28] transition-opacity duration-300 ${heroLoaded ? "opacity-[0.28]" : "opacity-0"}`}
              style={{ objectPosition: "20% center" }}
            />
          </div>
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-14 text-white">
            <img src="/zappir_logo_white&blue(1).png" alt="Zappir logo" className="mx-auto h-auto w-56" />
            <p className="mt-10 max-w-lg text-center text-[0.8125rem] text-white/80">
              Welcome to Nudoc\u2122. A secure and reliable platform that simplifies the drafting and storage of your most important HR documents.
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
          {authFormContent}
        </section>
      </div>
    </div>
  );
};

export default Auth;

