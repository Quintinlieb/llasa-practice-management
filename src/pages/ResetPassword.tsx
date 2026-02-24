import { useEffect, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import { X } from "lucide-react";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one special character");

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [status, setStatus] = useState<"checking" | "ready" | "missing" | "error" | "success">("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const run = async () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus("ready");
        } else if (tokenHash && queryType === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          setStatus("ready");
        } else if (type === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setStatus("ready");
        } else {
          setStatus("missing");
          setStatusMessage("Reset link is missing or expired. Please request a new link.");
        }
      } catch (error: unknown) {
        setStatus("error");
        setStatusMessage(getSafeErrorMessage(error));
      } finally {
        if (hash) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
      }
    };

    run();
  }, []);

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
              Reset your Nudoc\u2122 password to keep your account secure and continue working on your HR documents.
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
                <h1 className="text-[1.35rem] font-semibold text-foreground">Reset password</h1>
                <p className="text-[0.8rem] text-muted-foreground">
                  Enter a new password for your account below.
                </p>
              </div>
            </div>

            {(status === "checking" || status === "missing" || status === "error") && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {status === "checking" ? "Validating reset link..." : statusMessage}
              </div>
            )}

            {status === "success" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                Password updated. You can now sign in with your new password.
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPasswordError("");
                setConfirmPasswordError("");
                if (status !== "ready") return;
                try {
                  passwordSchema.parse(formData.newPassword);
                } catch (error) {
                  if (error instanceof z.ZodError) {
                    setPasswordError(error.errors[0].message);
                  }
                  return;
                }
                if (formData.newPassword !== formData.confirmPassword) {
                  setConfirmPasswordError("Passwords do not match");
                  return;
                }

                setIsSaving(true);
                supabase.auth
                  .updateUser({ password: formData.newPassword })
                  .then(({ error }) => {
                    if (error) throw error;
                    toast({
                      title: "Password updated",
                      description: "You can now sign in with your new password.",
                    });
                    setStatus("success");
                  })
                  .catch((error: unknown) => {
                    toast({
                      title: "Error",
                      description: getSafeErrorMessage(error),
                      variant: "destructive",
                    });
                  })
                  .finally(() => setIsSaving(false));
              }}
              className="pt-6 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(event) =>
                    setFormData({ ...formData, newPassword: event.target.value })
                  }
                  className={passwordError ? "h-11 border-destructive" : "h-11"}
                />
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) =>
                    setFormData({ ...formData, confirmPassword: event.target.value })
                  }
                  className={confirmPasswordError ? "h-11 border-destructive" : "h-11"}
                />
                {confirmPasswordError && (
                  <p className="text-sm text-destructive">{confirmPasswordError}</p>
                )}
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  disabled={status !== "ready" || isSaving}
                >
                  {isSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>

            <div className="text-center text-xs text-muted-foreground">
              <Link
                to="/auth?login=1"
                className="text-muted-foreground hover:text-blue-600 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ResetPassword;
