import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import { supabase } from "@/integrations/supabase/client";

const loginFieldClass =
  "h-9 rounded-[3px] border-white/15 bg-white px-2 !text-[12px] text-slate-900 placeholder:text-[12px] placeholder:text-slate-400 hover:border-[#3eca44] focus:border-[#3eca44] focus-visible:border-[#3eca44]";

const ForgotPassword = () => {
  const [username, setUsername] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { resetPassword } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return;

    setIsSending(true);
    try {
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        "validate-reset-email",
        {
          body: { email: normalizedUsername },
        },
      );

      if (validationError) {
        throw validationError;
      }

      const emailExists = Boolean((validationData as { exists?: boolean } | null)?.exists);
      if (!emailExists) {
        setUsername("");
        toast({
          title: "Username/email does not exist",
          description: "Please enter a valid username or email address.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await resetPassword(normalizedUsername);

      if (error) {
        toast({
          title: "Reset email failed",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reset email sent",
        description: "Check your inbox for the password reset link.",
      });
      setIsSubmitted(true);
    } catch (error) {
      toast({
        title: "Reset email failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
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

            <form
              onSubmit={handleSubmit}
              className="pt-6 space-y-4"
              autoComplete="off"
              noValidate
            >
              <div
                className={`rounded-md border border-white/10 bg-[#2D4256] p-6 shadow-xl shadow-slate-900/15 ${
                  isSubmitted ? "min-h-[120px] flex items-center justify-center" : ""
                }`}
              >
                {isSubmitted ? (
                  <p className="text-center text-[0.9rem] text-white/85">
                    Password reset link sent successfully.
                  </p>
                ) : (
                  <>
                    <p className="mb-6 text-center text-[0.9rem] text-white/75">
                      Insert your username / email
                    </p>
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
                    <div className="pt-6">
                      <Button
                        type="submit"
                        className="w-full rounded-[3px] bg-[#3eca44] text-white hover:bg-[#3eca44]"
                        disabled={!username.trim() || isSending}
                      >
                        {isSending ? "Sending..." : "Submit"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </form>

            <div className="text-center text-xs text-muted-foreground">
              {isSubmitted ? (
                <>
                  Back to{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/auth?login=1")}
                    className="font-semibold text-muted-foreground hover:text-[#3eca44] hover:underline"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                "A password reset link will be sent to you"
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ForgotPassword;
