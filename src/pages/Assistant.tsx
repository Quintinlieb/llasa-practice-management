import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { Send, Smile, LogOut, Frown } from "lucide-react";

const promptChips = [
  "How to deal with deserting employee?",
  "Can employee resign without notice?",
  "Can I discipline for poor performance?",
  "Are polygraph tests allowed?",
  "Can employee refuse overtime request?",
  "Should employee pay for PPE?",
  "Can union official represent shop steward at hearing?",
  "Can I deduct for financial loss from a salary?",
  "More...",
];

const extraPromptChips = [
  "Is a warning valid if employee refuse to sign?",
  "Can I suspend an employee?",
  "How does temporary lay-off work?",
  "How do you conduct a hearing?",
  "What statutory payments are payable on retrenchment?",
  "Can attorney represent me at CCMA?",
  "Is unused leave forfeited?",
  "How do I deal with a strike?",
  "Previous",
];

const cannedResponses: Record<string, string> = {
  "How to deal with deserting employee?":
    "Desertion, also know as Abscondment, generally arises where an employee is absent from work for an extended period, usually 5 consecutive working days, without permission or communication. The employer should make reasonable attempts to contact the employee and issue an abscondment notice directing the employee to return to work by a specified date, failing which the absence may be regarded as a repudiation of the contract. If the employee fails to respond or return, the employer should finalise the matter through a procedurally fair hearing, after which the employment relationship may be terminated on the basis of abscondment.",
  "Is a warning valid if employee refuse to sign?":
    "Yes.\n\nA warning remains valid even if an employee refuses to sign it. The purpose of a signature is to acknowledge receipt, not agreement. If the employee refuses to sign, a witness should sign to confirm that the warning was issued and properly explained to the employee.",
  "Can I suspend an employee?":
    "Yes, but only in limited circumstances.\n\nAn employee may be placed on precautionary suspension pending a disciplinary hearing where the allegations are serious and the employee’s presence may prejudice the investigation or workplace operations. Such suspension must be on full pay, for a reasonable period, and must not be punitive.\n\nSuspension may also be imposed as a disciplinary sanction short of dismissal after a fair hearing. In this case, it is generally unpaid and should be for a limited period, preferably not exceeding two weeks, and must be appropriate to the seriousness of the misconduct.",
  "How does temporary lay-off work?":
    "A temporary lay-off is a measure used when an employer is temporarily unable to provide work, and it may also be used as an alternative to retrenchment.\n\nA temporary lay-off must be by agreement, either in the employment contract, a collective agreement, or reached through consultation with employees or their representatives. As part of a retrenchment consultation process, an employer may propose a temporary lay-off as a cost-saving measure to avoid job losses, provided it is properly consulted on and agreed to. During the lay-off, employees are generally not paid, but the employment relationship continues, and employees may claim UIF Temporary Lay-off benefits. The reasons, duration, and conditions of the lay-off should be clearly confirmed in writing.",
  "How do you conduct a hearing?":
    "A disciplinary hearing must be conducted in a procedurally fair manner, allowing the employee a proper opportunity to understand the allegations, prepare a defence, and be heard before any decision is made.\n\nSteps to conduct a disciplinary hearing:\n- Issue a written notice of hearing setting out the allegations clearly and in sufficient detail.\n- Explain the employee’s procedural rights in the notice, including the right to be assisted by a fellow employee or shop steward, the right to state a case, call witnesses, and make representations.\n- Allow the employee reasonable time to prepare for the hearing (at least 48 hours).\n- Conduct the hearing impartially, allowing the employer to present evidence and the employee to respond fully.\n- Consider all evidence, including mitigating and aggravating factors, before making a finding.\n- Decide on guilt and an appropriate sanction, if applicable.\n- Communicate the outcome and sanction in writing.\n\nA properly conducted hearing promotes procedural fairness and reduces the risk of disputes. It is advisable, particularly in serious matters, to appoint an independent chairperson, preferably a labour-law professional, to ensure impartiality and defensibility of the process.",
  "What statutory payments are payable on retrenchment?":
    "On retrenchment, an employer must pay the employee severance pay of at least one week’s remuneration for each completed year of continuous service, unless the employee unreasonably refuses an offer of suitable alternative employment. The employee must also be paid the applicable notice pay, unless the notice period is worked, as well as payment for any accrued but unused annual leave and any outstanding remuneration due up to the last day of employment. Employees may claim UIF benefits following retrenchment, but this is not paid by the employer.",
  "Can attorney represent me at CCMA?":
    "It depends on the type of CCMA proceedings.\n\nAt conciliation, legal representation is not permitted. Parties must represent themselves or be assisted by a trade union official, employers’ organisation representative, or a fellow employee.\n\nAt arbitration, legal representation is generally not allowed in dismissal disputes relating to misconduct or incapacity, unless the commissioner grants permission due to the complexity of the matter, legal issues involved, or comparative prejudice. In disputes other than misconduct or incapacity (for example, contractual or operational matters), legal representation may be permitted.",
  "Is unused leave forfeited?":
    "Yes, annual leave may be forfeited if it is not taken within the prescribed period.\n\nIn terms of the BCEA, annual leave must be taken within six months after the end of the leave cycle. The Labour Court confirmed that if an employee fails to take accrued annual leave within this six-month period, the leave may be forfeited, provided the employer has afforded the employee a reasonable opportunity to take the leave. It is advisable to include a clear clause in the employment contract confirming this position. Upon termination of employment, any leave accrued in the current leave cycle must still be paid out.",
  "How do I deal with a strike?":
    "The first step is to determine whether the strike is protected or unprotected.\n\nIf the strike is protected, the employer may not discipline or dismiss employees for participating, but may implement lawful operational measures, such as a no work no pay principle, and should continue engaging with the trade union to resolve the dispute. If the strike is unprotected, the employer should urgently communicate with employees, issue a return-to-work ultimatum, and warn of possible disciplinary action if the strike continues. Any discipline or dismissal must still follow a fair procedure and be proportionate to the circumstances.",
  "Can union official represent shop steward at hearing?":
    "No.\n\nIn terms of the Code of Good Practice on Dismissal, an employee is entitled to be assisted by a fellow employee or a trade union representative (shop steward) at a disciplinary hearing. A shop steward is therefore not entitled to representation by an external trade union official, unless the employer’s disciplinary code or a collective agreement expressly provides for such representation. Allowing an external union official remains a matter of employer discretion, subject to fairness.",
  "Are polygraph tests allowed?":
    "Yes, polygraph tests are permitted, but their use is limited.\n\nAn employee may not be forced to undergo a polygraph test and must give informed consent. Polygraph results may not be relied upon as primary evidence of misconduct and can only be used as corroborative evidence together with other proof. Where polygraph testing is conducted, it should be applied consistently to all employees who could reasonably have been involved, and not only to a single suspect, to avoid unfairness.",
  "Can employee refuse overtime request?":
    "As a general rule, overtime must be by agreement and an employee may not be forced to work overtime.\n\nWhere an employee has agreed in advance, either in the employment contract or otherwise, to work overtime, the employee may not unreasonably refuse lawful and reasonable overtime. Where there is no prior agreement to work overtime, the employee is entitled to refuse. In all cases, overtime must comply with the BCEA limits and be remunerated in accordance with the Act.",
  "Should employee pay for PPE?":
    "No. As a general rule, employees should not be required to pay for PPE.\n\nIn terms of the Occupational Health and Safety Act and accepted labour practice, PPE required to perform work safely must be provided and paid for by the employer, and the cost may not be deducted from an employee’s wages. Limited exceptions may arise where an employee voluntarily purchases PPE from the employer, or where an employee is held liable for loss or damage to PPE following a fair disciplinary process and in compliance with section 34 of the BCEA. Outside of these limited circumstances, requiring employees to pay for PPE is generally not permitted.",
  "Can I deduct for financial loss from a salary?":
    "Yes, but only in limited circumstances.\n\nIn terms of section 34 of the Basic Conditions of Employment Act, deductions for financial loss may only be made if the employee has given written consent, or if the deduction follows a fair disciplinary hearing where the employee is found responsible and the deduction is recommended. The loss must be proven, the amount must be reasonable, and the employee must be given an opportunity to give statement. Without consent, a fair hearing outcome, or a court order, such deductions are not permitted.",
  "Can employee resign without notice?":
    "Legally, no but practically, yes.\n\nIn terms of the BCEA, an employee is required to give notice of resignation: one week if employed for six months or less, two weeks if employed for more than six months but less than one year, and four weeks if employed for one year or more.\n\nIn practice, if an employee resigns without notice, you cannot force the employee to return and work the notice period and you may not withhold final payment. The only way to compel an employee to work notice would be by obtaining a court order from the Labour Court, which is rarely practical or cost-effective.",
  "Can I discipline for poor performance?":
    "No. Poor performance is not misconduct and should not be dealt with through disciplinary action.\n\nPoor performance must be managed through an incapacity process, which includes setting clear performance standards, identifying shortcomings, providing counselling, training or support, and allowing a reasonable opportunity to improve. If performance does not improve, the employee must be invited to an incapacity hearing, after which dismissal may be considered only if continued poor performance is established despite support.",
};

const followUpResponse =
  "There is no fixed period prescribed by law. In practice, a reasonable improvement period is often around one month, but this depends on the nature and complexity of the employee's position, the standard of performance required, and the level of skill involved. Senior or highly skilled roles may require a longer improvement period, while simpler or routine positions may justify a shorter period, provided the employee has been properly supported and given a fair opportunity to improve.";

const Assistant = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const maxMessageChars = 450;
  const maxDailyPrompts = 10;
  const [remainingPrompts, setRemainingPrompts] = useState<number>(maxDailyPrompts);
  const [displayName, setDisplayName] = useState<string>("there");
  const [userInitials, setUserInitials] = useState<string>("U");
  const [greeting, setGreeting] = useState("Good Morning");
  const [message, setMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showExtraPrompts, setShowExtraPrompts] = useState(false);
  type ChatMessage = { id: string; author: "assistant" | "user"; text: string };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingResponse, setPendingResponse] = useState<string | null>(null);
  const [typingText, setTypingText] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const limitReached = remainingPrompts === 0;
  const inputDisabled = limitReached && !isChatOpen;

  useEffect(() => {
    if (!user?.id) {
      setDisplayName("there");
      return;
    }

    const cachedName = localStorage.getItem("assistant_display_name")?.trim();
    const metadataName =
      (user.user_metadata?.first_name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined);
    const quickName =
      (metadataName && metadataName.split(" ")[0]?.trim()) || cachedName;
    if (quickName) {
      setDisplayName(quickName);
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
        localStorage.setItem("assistant_display_name", firstName);
      } else {
        const fallbackName = cachedName || "there";
        setDisplayName(fallbackName);
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

  useEffect(() => {
    if (!user?.id) return;
    const loadDailyUsage = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => {
                maybeSingle: () => Promise<{
                  data: { request_count?: number } | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      })
        .from("assistant_usage")
        .select("request_count")
        .eq("company_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();
      if (error) {
        console.error("Failed to load assistant usage", error);
        return;
      }
      const used = Number(data?.request_count ?? 0);
      if (!Number.isNaN(used)) {
        setRemainingPrompts(Math.max(0, maxDailyPrompts - used));
      }
    };
    void loadDailyUsage();
  }, [user, maxDailyPrompts]);

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

  const requestAssistantResponse = async (
    text: string,
    history: Array<{ author: "assistant" | "user"; text: string }> = [],
  ) => {
    try {
      setIsAwaitingResponse(true);
      const normalizedHistory = history
        .filter((item) => item.text.trim())
        .slice(-8)
        .map((item) => ({
          role: item.author === "assistant" ? "assistant" : "user",
          content: item.text,
        }));
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { message: text, history: normalizedHistory },
      });
      if (error) {
          const context = (error as { context?: Response })?.context;
          if (context instanceof Response) {
            if (context.status === 429) {
              const remaining = Number(data?.remaining);
              if (!Number.isNaN(remaining)) {
                setRemainingPrompts(remaining);
              }
              setDailyLimitReached(true);
              toast({
                title: "Daily limit reached",
                description:
                  "Sorry! Unfortunately you have reached your daily question limit. Please ask again tomorrow.",
                variant: "destructive",
              });
              return;
            }
          }
        let detail = "";
        if (context instanceof Response) {
          try {
            detail = await context.text();
          } catch {
            detail = "";
          }
        }
        const message = detail ? `${error.message}: ${detail}` : error.message;
        throw new Error(message);
      }
      const reply = data?.reply;
      const remaining = Number(data?.remaining);
      if (!Number.isNaN(remaining)) {
        setRemainingPrompts(remaining);
      }
      setDailyLimitReached(false);
      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("Empty reply");
      }
      setPendingResponse(reply);
    } catch (err) {
      console.error("Assistant request failed", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setPendingResponse(
        `Sorry, I couldn't fetch a response right now. ${errorMessage}`,
      );
    } finally {
      setIsAwaitingResponse(false);
    }
  };

  const openChatWithMessage = async (text: string) => {
    if (!text.trim()) return;
    const next = text.trim();
    if (next === "More...") {
      setShowExtraPrompts(true);
      return;
    }
    if (next === "Previous") {
      setShowExtraPrompts(false);
      return;
    }
    const canned = cannedResponses[next];
    setIsChatOpen(true);
    const seedMessages: ChatMessage[] = [
      { id: `user-${Date.now()}`, author: "user", text: next },
    ];
    setMessages(seedMessages);
    setPendingResponse(null);
    setMessage("");
    if (canned) {
      setDailyLimitReached(false);
      setPendingResponse(canned);
      return;
    }
    if (limitReached) {
      setDailyLimitReached(true);
      return;
    }
    setRemainingPrompts((prev) => Math.max(0, prev - 1));
    await requestAssistantResponse(next, seedMessages);
  };

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    await openChatWithMessage(message);
  };

  const handleClearChat = () => {
    setIsChatOpen(false);
    setMessages([]);
    setMessage("");
    setPendingResponse(null);
    setTypingText("");
    setDailyLimitReached(false);
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
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full w-full">
            <div
            className={`mb-0 flex w-full flex-col rounded-none border-0 bg-white px-6 text-center shadow-none ${
              isChatOpen
                ? "h-[calc(100vh-8rem)] items-stretch justify-start overflow-hidden pt-3 pb-4"
                : "min-h-[calc(100vh-8rem)] items-center justify-center py-12"
            }`}
            >
            {!isChatOpen ? (
              <>
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-slate-500" />
                </span>

                <div className="space-y-4 mb-10 mt-3">
                  <h1 className="text-4xl font-semibold text-slate-900 leading-snug">
                    <span className="block">
                      Hi, {displayName}
                    </span>
                    <span className="block">
                      How Can I <span className="text-blue-700">Assist You Today?</span>
                    </span>
                  </h1>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex w-full max-w-3xl flex-wrap justify-center gap-3">
                    {(showExtraPrompts ? extraPromptChips : promptChips).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => openChatWithMessage(chip)}
                        className={`w-auto whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-blue-700 ${
                          chip === "More..." || chip === "Previous"
                            ? "text-blue-700"
                            : "text-slate-700"
                        }`}
                      >
                        {chip === "Previous" ? "< Previous" : chip}
                      </button>
                    ))}
                  </div>
                </div>

                <form className="w-full max-w-2xl translate-y-10" onSubmit={handleSubmit}>
                  <div className="relative rounded-sm border border-slate-300 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.16)] hover:border-blue-400 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200">
                    <div className="absolute left-3 -top-5 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{message.length}/{maxMessageChars} characters used</span>
                      <span>|</span>
                      <span>{maxDailyPrompts - remainingPrompts}/{maxDailyPrompts} daily questions asked</span>
                    </div>
                    {limitReached && !isChatOpen && (
                      <Frown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    )}
                    <Input
                      value={message}
                      maxLength={maxMessageChars}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={limitReached ? "Daily limit reached" : "Type your question here..."}
                      disabled={inputDisabled}
                      className={`h-12 border-0 bg-transparent pr-12 text-sm shadow-none focus-visible:ring-0 hover:border-transparent focus-visible:border-transparent focus-visible:border-0 placeholder:text-slate-500 ${inputDisabled ? "pl-9" : ""}`}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110 hover:bg-primary"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {limitReached && (
                    <div className="mt-2 text-[10px] text-red-600">
                      You can ask more questions tomorrow or try one of the suggested questions above.
                    </div>
                  )}
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
                  {dailyLimitReached && (
                    <div className="flex items-end gap-3 justify-end">
                      <div className="flex max-w-[70%] items-center gap-2 rounded-2xl px-4 py-2 text-[10px] shadow-sm text-left bg-rose-50 text-rose-700 border border-rose-200 rounded-br-none">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-200 text-[10px] font-semibold text-rose-700">
                          !
                        </span>
                        <span>Oops! Daily question limit reached.</span>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-700 text-xs font-semibold shadow-sm">
                        HR
                      </div>
                    </div>
                  )}
                  {isAwaitingResponse && !pendingResponse && (
                    <div className="flex items-center gap-3 justify-end">
                      <span className="text-lg font-semibold text-slate-400 animate-pulse">...</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-700 text-xs font-semibold shadow-sm">
                        HR
                      </div>
                    </div>
                  )}
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

                <div className="flex w-full justify-center pt-2 pb-4">
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
                    if (message.length > maxMessageChars) return;
                    if (limitReached) {
                      setDailyLimitReached(true);
                      return;
                    }
                    const text = message.trim();
                    const followUp = getFollowUpResponse(text);
                    const nextMessage: ChatMessage = {
                      id: `user-${Date.now()}`,
                      author: "user",
                      text,
                    };
                    const nextMessages = [...messages, nextMessage];
                    setMessages(nextMessages);
                    setMessage("");
                    if (followUp) {
                      setPendingResponse(followUp);
                      return;
                    }
                    setRemainingPrompts((prev) => Math.max(0, prev - 1));
                    void requestAssistantResponse(text, nextMessages);
                  }}
                >
                  <div className="relative rounded-sm border border-slate-300 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.16)] hover:border-blue-400 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200">
                    <div className="absolute left-3 -top-6 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{message.length}/{maxMessageChars} characters used</span>
                      <span>|</span>
                      <span>{maxDailyPrompts - remainingPrompts}/{maxDailyPrompts} daily questions asked</span>
                    </div>
                    <Input
                      value={message}
                      maxLength={maxMessageChars}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={limitReached ? "Please type question here..." : "Type your question here..."}
                      disabled={inputDisabled}
                      className="h-12 border-0 bg-transparent pr-12 text-sm shadow-none focus-visible:ring-0 hover:border-transparent focus-visible:border-transparent focus-visible:border-0 placeholder:text-slate-500"
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
      </div>
    </DashboardLayout>
  );
};

export default Assistant;
