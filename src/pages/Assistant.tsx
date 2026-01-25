import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Flower2, Send, Smile, LogOut } from "lucide-react";

const promptChips = [
  "How to deal with deserting employee?",
  "Can employee resign without notice?",
  "Can I discipline for poor performance?",
  "Are polygraph tests allowed?",
  "Can employee refuse overtime request?",
  "Should employee pay for PPE?",
  "Can attorney represent employee at hearing?",
  "Can I deduct damages from a salary?",
];

const cannedResponses: Record<string, string> = {
  "Can I deduct damages from a salary?":
    "Yes, but only in limited circumstances. In terms of section 34 of the Basic Conditions of Employment Act, deductions may only be made with the employee's written consent. If the employee refuses to grant consent, a deduction may still be made if it is recommended by a chairperson following a fair disciplinary hearing, or if it is authorised by a court order.",
  "Can I discipline for poor performance?":
    "No. Poor performance is not misconduct and should not be dealt with through discipline.\n\nThe employer must set clear and measurable performance standards, identify where performance is lacking, counsel the employee, and provide appropriate training, guidance or support. The employee must be given a reasonable opportunity and time to improve, with regular performance reviews. If performance remains unsatisfactory, the employee must receive notice to attend an incapacity hearing for poor performance, be given an opportunity to make representations, and only thereafter may dismissal be considered.\n\nBefore dismissal, the employer must always consider sanctions short of dismissal, such as additional training, revised targets, demotion where appropriate, or transfer to a more suitable position.",
};

const followUpResponse =
  "There is no fixed period prescribed by law. In practice, a reasonable improvement period is often around one month, but this depends on the nature and complexity of the employee's position, the standard of performance required, and the level of skill involved. Senior or highly skilled roles may require a longer improvement period, while simpler or routine positions may justify a shorter period, provided the employee has been properly supported and given a fair opportunity to improve.";

const Assistant = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>("there");
  const [userInitials, setUserInitials] = useState<string>("U");
  const [greeting, setGreeting] = useState("Good Morning");
  const [message, setMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ id: string; author: "assistant" | "user"; text: string }>
  >([]);
  const [pendingResponse, setPendingResponse] = useState<string | null>(null);
  const [typingText, setTypingText] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setDisplayName("there");
      return;
    }

    const loadProfileName = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_name, user_surname")
        .eq("id", user.id)
        .maybeSingle();
      const firstName = data?.user_name?.trim() || "";
      const surname = data?.user_surname?.trim() || "";
      if (firstName) {
        setDisplayName(firstName);
      } else {
        const emailName = user.email?.split("@")[0]?.trim();
        setDisplayName(emailName || "there");
      }
      const initials = `${firstName.charAt(0)}${surname.charAt(0)}`.toUpperCase();
      if (initials.trim()) {
        setUserInitials(initials);
      } else {
        const fallback = (firstName || user.email || "U").charAt(0).toUpperCase();
        setUserInitials(fallback);
      }
    };

    loadProfileName();
  }, [user]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good Morning");
    } else if (hour < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  const getFollowUpResponse = (text: string) => {
    const normalized = text.toLowerCase();
    if (normalized.includes("how long") && normalized.includes("improv")) {
      return followUpResponse;
    }
    if (normalized.includes("time") && normalized.includes("improv")) {
      return followUpResponse;
    }
    return null;
  };

  const openChatWithMessage = (text: string) => {
    if (!text.trim()) return;
    const next = text.trim();
    const canned = cannedResponses[next];
    setIsChatOpen(true);
    setMessages([{ id: `user-${Date.now()}`, author: "user", text: next }]);
    setPendingResponse(canned || "Sure - I can help with that.");
    setMessage("");
  };

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    openChatWithMessage(message);
  };

  const handleClearChat = () => {
    setIsChatOpen(false);
    setMessages([]);
    setMessage("");
    setPendingResponse(null);
    setTypingText("");
  };

  useEffect(() => {
    if (!pendingResponse) return;
    setTypingText("");
    setShowThinking(true);
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const thinkingDelay = setTimeout(() => {
      setShowThinking(false);
      let index = 0;
      intervalId = setInterval(() => {
        index += 1;
        setTypingText(pendingResponse.slice(0, index));
        if (index >= pendingResponse.length) {
          if (intervalId) clearInterval(intervalId);
          setMessages((prev) => [
            ...prev,
            { id: `assistant-${Date.now()}`, author: "assistant", text: pendingResponse },
          ]);
          setPendingResponse(null);
        }
      }, 12);
    }, 3000);
    return () => {
      clearTimeout(thinkingDelay);
      if (intervalId) clearInterval(intervalId);
    };
  }, [pendingResponse]);

  useEffect(() => {
    if (!isChatOpen) return;
    const container = messagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isChatOpen, messages, typingText, showThinking]);

  return (
    <DashboardLayout>
      <div className="-ml-6 -mr-6 pl-3 pr-3 -mt-3">
        <div className="flex h-full w-full">
          <div
            className={`mb-2 flex w-full flex-col rounded-sm border border-slate-300 bg-white px-6 text-center shadow-sm ${
              isChatOpen
                ? "h-[calc(100vh-8rem)] items-stretch justify-start overflow-hidden pt-3 pb-4"
                : "min-h-[calc(100vh-8rem)] items-center justify-center py-12"
            }`}
          >
            {!isChatOpen ? (
              <>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                  <Flower2 className="h-6 w-6 text-slate-500" />
                </span>

                <div className="space-y-4 mb-10">
                  <h1 className="text-3xl font-semibold text-slate-900">
                    <span className="block">
                      {greeting}, {displayName}
                    </span>
                    <span className="block">
                      How Can I <span className="text-blue-700">Assist You Today?</span>
                    </span>
                  </h1>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex w-full max-w-3xl flex-wrap justify-center gap-3">
                    {promptChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => openChatWithMessage(chip)}
                        className="min-w-[240px] whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 py-2 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-700"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <form className="w-full max-w-2xl translate-y-6" onSubmit={handleSubmit}>
                  <div className="relative rounded-sm border border-slate-300 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.16)] hover:border-blue-400 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200">
                    <Input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Ask Something"
                      className="h-12 border-0 bg-transparent pr-12 text-sm shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110 hover:bg-primary"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex h-full w-full flex-1 flex-col">
                <div className="flex-1 overflow-hidden px-2 pt-2">
                  <div
                    ref={messagesRef}
                    className="h-full space-y-2 overflow-y-auto pb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                  {messages.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-end gap-3 ${item.author === "user" ? "justify-start" : "justify-end"}`}
                    >
                      {item.author === "user" && (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm">
                          {userInitials}
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm text-left whitespace-pre-line ${
                          item.author === "user"
                            ? "bg-slate-100 text-slate-800 rounded-bl-none"
                            : "bg-primary text-primary-foreground rounded-br-none"
                        }`}
                      >
                        {item.text}
                      </div>
                      {item.author === "assistant" && (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-700 text-xs font-semibold shadow-sm">
                          HR
                        </div>
                      )}
                    </div>
                  ))}
                  {showThinking && (
                    <div className="flex items-center gap-3 justify-end">
                      <span className="text-lg font-semibold text-slate-400 animate-pulse">...</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-700 text-xs font-semibold shadow-sm">
                        HR
                      </div>
                    </div>
                  )}
                  {!showThinking && pendingResponse && (
                    <div className="flex items-end gap-3 justify-end">
                      <div
                        className="w-full max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm text-left whitespace-pre-line bg-primary text-primary-foreground rounded-br-none"
                      >
                        {typingText}
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-700 text-xs font-semibold shadow-sm">
                        HR
                      </div>
                    </div>
                  )}
                </div>
                </div>

                <div className="flex w-full justify-center pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 gap-2 rounded-full border-slate-200 bg-white text-xs text-slate-600 hover:border-blue-500 hover:bg-white hover:text-slate-600"
                    onClick={handleClearChat}
                  >
                    <LogOut className="h-4 w-4" />
                    Exit chat
                  </Button>
                </div>

                <form
                  className="relative mx-auto w-full pb-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!message.trim()) return;
                    const text = message.trim();
                    const followUp = getFollowUpResponse(text);
                    setMessages((prev) => [
                      ...prev,
                      { id: `user-${Date.now()}`, author: "user", text },
                    ]);
                    setMessage("");
                    if (followUp) {
                      setPendingResponse(followUp);
                    }
                  }}
                >
                  <div className="relative rounded-sm border border-slate-300 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.16)] hover:border-blue-400 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200">
                    <Input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Ask Something"
                      className="h-12 border-0 bg-transparent pr-12 text-sm shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110 hover:bg-primary"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Assistant;
