import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import { clearAuthFormDraft, readAuthFormDraft, writeAuthFormDraft } from "@/lib/authFormDraft";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __llasaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { signUp, signIn, signOut, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const authActionStartedRef = useRef(false);

  useEffect(() => {
    const draft = readAuthFormDraft();
    if (!draft) return;
    const params = new URLSearchParams(location.search);
    const forceLogin = params.get("login") === "1";

    if (!forceLogin) {
      setIsLogin(draft.isLogin);
    }

    if (forceLogin || draft.isLogin) {
      clearAuthFormDraft();
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setSurname("");
      setContactNumber("");
      return;
    }

    setName(draft.name);
    setSurname(draft.surname);
    setContactNumber(draft.contactNumber);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }, [location.search]);

  useEffect(() => {
    writeAuthFormDraft({
      isLogin,
      name,
      surname,
      contactNumber,
      email: isLogin ? "" : email,
      password: isLogin ? "" : password,
      confirmPassword: isLogin ? "" : confirmPassword,
    });
  }, [isLogin, name, surname, contactNumber, email, password, confirmPassword]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstallAvailable = () => {
      if (window.__llasaInstallPrompt) {
        setDeferredInstallPrompt(window.__llasaInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      window.__llasaInstallPrompt = null;
      toast({
        title: "LLASA Manager installed",
        description: "You can now launch it from your Windows desktop or Start menu.",
      });
    };

    if (window.__llasaInstallPrompt) {
      setDeferredInstallPrompt(window.__llasaInstallPrompt);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("llasa-install-available", handleInstallAvailable as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("llasa-install-available", handleInstallAvailable as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast]);

  useEffect(() => {
    const checkProfileAndRedirect = async () => {
      const params = new URLSearchParams(location.search);
      const fromLogin = params.get("login") === "1";
      // Skip auto-redirects while still unauthenticated when explicitly starting a login flow.
      if (fromLogin && !user) return;
      if (!loading && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          if (location.pathname !== "/clients-2") navigate("/clients-2");
          return;
        }

        const { data: subuser } = await (supabase as any)
          .from("subusers")
          .select("id,status")
          .eq("auth_user_id", user.id)
          .in("status", ["accepted", "active"])
          .maybeSingle();

        if (subuser) {
          if (location.pathname !== "/clients-2") navigate("/clients-2");
          return;
        }

        // Fallback for subusers when RLS blocks direct subusers-row reads.
        // Manual subuser creation stores company_id in auth user metadata.
        const metadataCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
        if (metadataCompanyId) {
          if (location.pathname !== "/clients-2") navigate("/clients-2");
          return;
        }

        // Main-user fallback: if profile row is missing, create a minimal one
        // so the user can proceed without legacy company-setup flow.
        const metaName = String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim();
        const metaSurname = String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim();
        const metaContact = String((user as any)?.user_metadata?.user_contact || (user as any)?.user_metadata?.contact_number || "").trim();
        const emailValue = String(user.email || "").trim();
        const defaultName = metaName || "User";
        const defaultSurname = metaSurname || "Profile";
        const defaultContact = metaContact || "N/A";

        const profilePayloads: Record<string, unknown>[] = [
          {
            id: user.id,
            account_type: "business",
            company_name: `${defaultName} ${defaultSurname}`.trim(),
            registration_number: "N/A",
            physical_address: "N/A",
            postal_address: "N/A",
            representative_name: defaultName,
            representative_surname: defaultSurname,
            company_contact: defaultContact,
            company_email: emailValue || "N/A",
            user_name: defaultName,
            user_surname: defaultSurname,
            user_contact: defaultContact,
            user_email: emailValue || "N/A",
            company_type: "(Pty) Ltd",
          },
          {
            id: user.id,
            user_name: defaultName,
            user_surname: defaultSurname,
            user_contact: defaultContact,
            user_email: emailValue || "N/A",
            role: "Master user",
          },
          {
            id: user.id,
            user_name: defaultName,
            user_surname: defaultSurname,
            user_email: emailValue || "N/A",
          },
          {
            id: user.id,
            name: defaultName,
            surname: defaultSurname,
            contact_number: defaultContact,
            email: emailValue || "N/A",
            role: "Master user",
          },
          {
            id: user.id,
            name: defaultName,
            surname: defaultSurname,
            email: emailValue || "N/A",
          },
          {
            id: user.id,
            full_name: `${defaultName} ${defaultSurname}`.trim(),
            email: emailValue || "N/A",
          },
        ];

        let profileCreated = false;
        for (const payload of profilePayloads) {
          const { error: createProfileError } = await (supabase as any)
            .from("profiles")
            .upsert(payload, { onConflict: "id" });
          if (!createProfileError) {
            profileCreated = true;
            break;
          }
        }

        // Never block auth if profile schema changed again.
        if (!profileCreated && authActionStartedRef.current) {
          toast({
            title: "Profile sync warning",
            description: "Signed in, but profile record could not be created automatically.",
            variant: "destructive",
          });
        }
        if (location.pathname !== "/clients-2") navigate("/clients-2");
      }
    };

    void checkProfileAndRedirect();
  }, [user, loading, navigate, location.pathname, location.search]);

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
    authActionStartedRef.current = true;

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Error",
            description: getSafeErrorMessage(error),
            variant: "destructive",
          });
        } else {
          navigate("/clients-2", { replace: true });
        }
      } else {
        const { data, error } = await signUp(email, password, {
          name: name.trim(),
          surname: surname.trim(),
          contactNumber: contactNumber.trim(),
        });
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
          const signedUpEmail = email.trim();
          toast({
            title: "Success",
            description: "Account created! Please confirm your email and then sign in.",
          });
          setIsLogin(true);
          setEmail(signedUpEmail);
          setPassword("");
          setConfirmPassword("");
          navigate("/auth?login=1", { replace: true });
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

  const handleDesktopDownload = async () => {
    const prompt = deferredInstallPrompt ?? window.__llasaInstallPrompt ?? null;
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        toast({
          title: "Installing LLASA Manager",
          description: "Complete the prompt to add LLASA Manager to your desktop.",
        });
      }
      setDeferredInstallPrompt(null);
      window.__llasaInstallPrompt = null;
      return;
    }

    toast({
      title: "Desktop install unavailable",
      description: "Reload once, then use Edge or Chrome and click Download for your Desktop again.",
      variant: "destructive",
    });
  };

  const isSignupReady =
    !isLogin &&
    name.trim().length > 0 &&
    surname.trim().length > 0 &&
    contactNumber.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    confirmPassword.trim().length > 0;
  const signupFieldClass =
    "h-[30px] rounded-[3px] border-[1.75px] border-slate-300 bg-white px-2 text-[8px] font-medium text-slate-900 shadow-none placeholder:text-[8px] placeholder:text-slate-400 hover:border-[#3eca44] focus:border-[#3eca44] focus-visible:border-[#3eca44] ring-0 ring-offset-0 outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none";
  const loginFieldClass =
    "h-9 rounded-[3px] border-white/15 bg-white px-2 !text-[12px] text-slate-900 placeholder:text-[12px] placeholder:text-slate-400 hover:border-[#3eca44] focus:border-[#3eca44] focus-visible:border-[#3eca44]";
  const authFormContent = (
    <div className="w-full max-w-md space-y-4">
      <div className="text-center space-y-3">
        <div className="mx-auto flex items-center justify-center">
          <img src="/Vertical Logo (2).png" alt="LLASA vertical logo" className="h-32 w-auto" />
        </div>
        <div className={isLogin ? "space-y-1 translate-y-2" : "space-y-1"}>
          {!isLogin && (
            <h1 className="text-[1.35rem] font-semibold text-foreground">
              Create account
            </h1>
          )}
          {!isLogin && (
            <p className="text-[0.8rem] text-muted-foreground">
              Go ahead and fill out the form to get started.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pt-6 space-y-4" autoComplete={isLogin ? "on" : "off"} noValidate>
        {(
          <>
            <div className={isLogin ? "rounded-md border border-white/10 bg-[#2D4256] p-6 shadow-xl shadow-slate-900/15" : ""}>
              {isLogin && (
                <p className="mb-6 text-center text-[0.9rem] text-white/75">
                  Sign in to your account
                </p>
              )}
              {!isLogin && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="group space-y-1">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Type your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="given-name"
                      required
                      className={signupFieldClass}
                    />
                  </div>
                  <div className="group space-y-1">
                    <Label htmlFor="surname">Surname</Label>
                    <Input
                      id="surname"
                      type="text"
                      placeholder="Type your surname"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      autoComplete="family-name"
                      required
                      className={signupFieldClass}
                    />
                  </div>
                  <div className="group space-y-1 sm:col-span-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      type="text"
                      placeholder="Type your contact number"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      autoComplete="tel"
                      required
                      className={signupFieldClass}
                    />
                  </div>
                </div>
              )}
              <div className="group space-y-1">
                {!isLogin && <Label htmlFor="email">Username:</Label>}
                <Input
                  id="email"
                  type="email"
                  placeholder={isLogin ? "Username" : "Type your email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete={isLogin ? "username" : "off"}
                  required
                  className={isLogin ? loginFieldClass : signupFieldClass}
                />
              </div>
              <div className="mt-4 space-y-2">
                <div className="space-y-1">
                  <div className={isLogin ? "" : "flex items-center justify-between"}>
                    {!isLogin && <Label htmlFor="password">Password:</Label>}
                    {!isLogin && (
                      <div className="relative group inline-flex items-center gap-2 cursor-help text-[11px] text-muted-foreground">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">Password requirements</span>
                        <div className="invisible absolute right-0 top-full z-10 mt-2 w-56 rounded border border-[#3eca44] bg-background p-3 text-[11px] leading-relaxed opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                          <p className="mb-1 font-medium text-[#3eca44]">Include:</p>
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
                      placeholder={isLogin ? "Password" : "Type your password"}
                      value={password}
                      onChange={handlePasswordChange}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                      minLength={isLogin ? 6 : 8}
                      className={
                        isLogin
                          ? `${loginFieldClass} pr-10`
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
                        onClick={() => navigate("/forgot-password")}
                        className="text-[11px] font-normal text-white/70 underline hover:text-[#3eca44]"
                      >
                        Forgot your password?
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
              </div>
              <div className="pt-6">
                <Button
                  type="submit"
                  className="w-full rounded-[3px] bg-[#3eca44] text-white hover:bg-[#3eca44]"
                  disabled={isLoading || (isLogin ? false : !isSignupReady)}
                >
                  {isLoading ? "Please wait..." : isLogin ? "Sign in" : "Sign up"}
                </Button>
              </div>
            </div>
          </>
        )}
      </form>

      <div className="text-center text-xs text-muted-foreground">
        {isLogin ? (
          <button
            type="button"
            onClick={() => void handleDesktopDownload()}
            className="text-muted-foreground hover:text-[#3eca44] hover:underline"
          >
            Download for your Desktop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/auth?login=1", { replace: true })}
            className="text-muted-foreground hover:text-[#3eca44] hover:underline"
          >
            Already have an account? <span className="font-semibold">Sign in</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="w-full max-w-md px-2 py-2">
          {authFormContent}
        </section>
      </main>
    </div>
  );
};

export default Auth;

