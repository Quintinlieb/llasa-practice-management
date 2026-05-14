import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/errorHandling";

const loginFieldClass =
  "h-9 rounded-[3px] border-white/15 bg-white px-2 !text-[12px] text-slate-900 placeholder:text-[12px] placeholder:text-slate-400 hover:border-[#3eca44] focus:border-[#3eca44] focus-visible:border-[#3eca44]";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

const ResetPassword = () => {
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "missing" | "error">("checking");
  const [statusMessage, setStatusMessage] = useState("Validating reset link...");
  const navigate = useNavigate();
  const { toast } = useToast();

  const showManualTypingToast = () => {
    toast({
      title: "Manual entry required",
      description: "Please type the confirm password field manually.",
    });
  };

  useEffect(() => {
    const validateResetLink = async () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus("ready");
          setStatusMessage("");
        } else if (tokenHash && queryType === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          setStatus("ready");
          setStatusMessage("");
        } else if (hashType === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setStatus("ready");
          setStatusMessage("");
        } else {
          setStatus("missing");
          setStatusMessage("Reset link is missing or expired. Please request a new link.");
        }
      } catch (error: unknown) {
        setStatus("error");
        setStatusMessage(getSafeErrorMessage(error));
      } finally {
        if (hash) {
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        }
      }
    };

    validateResetLink();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setConfirmPasswordError("");

    if (status !== "ready") {
      toast({
        title: "Reset link invalid",
        description: statusMessage || "Please request a new password reset link.",
        variant: "destructive",
      });
      return;
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordError(error.errors[0].message);
      }
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });
      navigate("/auth?login=1", { replace: true });
    } catch (error: unknown) {
      toast({
        title: "Password update failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="w-full max-w-md px-2 py-2">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center space-y-3">
              <div className="mx-auto flex items-center justify-center">
                <img src="/Vertical Logo (2).png" alt="LLASA vertical logo" className="h-32 w-auto" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="pt-6 space-y-4" autoComplete="off" noValidate>
              <div className="rounded-md border border-white/10 bg-[#2D4256] p-6 shadow-xl shadow-slate-900/15">
                <p className="mb-6 text-center text-[0.9rem] text-white/75">
                  Insert your new password.
                </p>
                {status !== "ready" && (
                  <div className="mb-4 rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    {statusMessage}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="group space-y-1">
                    <Input
                      id="username"
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      required
                      className={loginFieldClass}
                    />
                  </div>
                  <div className="group space-y-1">
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        onCopy={(event) => {
                          event.preventDefault();
                          showManualTypingToast();
                        }}
                        onCut={(event) => {
                          event.preventDefault();
                          showManualTypingToast();
                        }}
                        autoComplete="new-password"
                        required
                        className={`${loginFieldClass} pr-10 ${passwordError ? "border-destructive" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                  </div>
                  <div className="group space-y-1">
                    <div className="relative">
                      <Input
                        id="confirmNewPassword"
                        type={showConfirmNewPassword ? "text" : "password"}
                        placeholder="Confirm New Password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        onPaste={(event) => {
                          event.preventDefault();
                          showManualTypingToast();
                        }}
                        autoComplete="new-password"
                        required
                        className={`${loginFieldClass} pr-10 ${confirmPasswordError ? "border-destructive" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPasswordError && <p className="text-sm text-destructive">{confirmPasswordError}</p>}
                  </div>
                </div>
                <div className="pt-6">
                  <Button
                    type="submit"
                    className="w-full rounded-[3px] bg-[#3eca44] text-white hover:bg-[#3eca44]"
                    disabled={
                      status !== "ready" ||
                      isSaving ||
                      !username.trim() ||
                      !newPassword.trim() ||
                      !confirmNewPassword.trim()
                    }
                  >
                    {isSaving ? "Updating..." : "Submit"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="text-center text-xs text-muted-foreground">
              Back to{" "}
              <button
                type="button"
                onClick={() => navigate("/auth?login=1")}
                className="font-semibold text-muted-foreground hover:text-[#3eca44] hover:underline"
              >
                Sign In
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ResetPassword;
