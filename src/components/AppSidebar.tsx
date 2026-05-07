import { FolderOpen, Users, Home, Headset, Bell, Settings, LogOut, BriefcaseBusiness, ChevronRight } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Clients 2", url: "/clients-2", icon: Users },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Case Files", url: "/case-files", icon: BriefcaseBusiness },
];

const documentSubmenuItems = [
  { title: "Discipline", url: "/documents/discipline" },
  { title: "Contracts", url: "/documents/contracts" },
  { title: "Terminations", url: "/documents" },
  { title: "Notices", url: "/documents/notices" },
  { title: "Litigation", url: "/documents" },
  { title: "Other", url: "/documents" },
];

const documentFlyoutItems: Record<string, Array<{ title: string; url: string; selectedDocument?: string }>> = {
  Discipline: [
    { title: "Code of Conduct", url: "/documents", selectedDocument: "codeOfConduct" },
    { title: "Warnings", url: "/documents", selectedDocument: "warnings" },
  ],
  Contracts: [
    { title: "Permanent Contract", url: "/documents", selectedDocument: "permanentContract" },
    { title: "Temporary Contract", url: "/documents", selectedDocument: "temporaryContract" },
    { title: "Addendum", url: "/documents", selectedDocument: "addendum" },
  ],
  Terminations: [
    { title: "Misconduct", url: "/documents", selectedDocument: "noticeTermination" },
    { title: "Ill Health", url: "/documents", selectedDocument: "illHealthTermination" },
    { title: "Poor Performance", url: "/documents", selectedDocument: "poorPerformanceTermination" },
    { title: "Abscondment/Desertion", url: "/documents", selectedDocument: "abscondmentTermination" },
    { title: "Retrenchment", url: "/documents", selectedDocument: "retrenchmentTermination" },
    { title: "Retirement", url: "/documents", selectedDocument: "retirementTermination" },
    { title: "Mutual Separation", url: "/documents", selectedDocument: "mutualTermination" },
  ],
  Notices: [
    { title: "Disciplinary Hearing", url: "/documents", selectedDocument: "disciplinaryHearingNotice" },
    { title: "Incapacity Hearing (Performance)", url: "/documents", selectedDocument: "incapacityPerformanceHearingNotice" },
    { title: "Incapacity Hearing (Ill Health)", url: "/documents", selectedDocument: "incapacityIllHealthHearingNotice" },
    { title: "Precautionary Suspension", url: "/documents", selectedDocument: "precautionarySuspensionNotice" },
    { title: "Contemplated Retrenchment (S189)", url: "/documents", selectedDocument: "contemplatedRetrenchmentNotice" },
  ],
  Litigation: [],
  Other: [
    { title: "Certificate of Service", url: "/documents", selectedDocument: "serviceCertificate" },
    { title: "Acknowledgement of Debt", url: "/documents", selectedDocument: "acknowledgementOfDebt" },
  ],
};

type AppSidebarProps = {
  isCollapsed: boolean;
};

export function AppSidebar({ isCollapsed }: AppSidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [openDocumentCategory, setOpenDocumentCategory] = useState<string | null>(null);
  const [activeFlyoutItemKey, setActiveFlyoutItemKey] = useState<string | null>(null);
  const [modalActiveCategory, setModalActiveCategory] = useState<string | null>(null);
  const [isDocumentsSubmenuOpen, setIsDocumentsSubmenuOpen] = useState(() => pathname.startsWith("/documents"));
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const submenuItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isFlyoutPositionReady, setIsFlyoutPositionReady] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideFlyout = flyoutRef.current?.contains(target);
      const clickedInsideAnchor = openDocumentCategory
        ? submenuItemRefs.current[openDocumentCategory]?.contains(target)
        : false;
      if (!clickedInsideFlyout && !clickedInsideAnchor) {
        setOpenDocumentCategory(null);
        setActiveFlyoutItemKey(null);
        setIsFlyoutPositionReady(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openDocumentCategory]);

  useEffect(() => {
    const documentToCategory: Record<string, string> = {
      warnings: "Discipline",
      codeOfConduct: "Discipline",
      permanentContract: "Contracts",
      temporaryContract: "Contracts",
      addendum: "Contracts",
      noticeTermination: "Terminations",
      illHealthTermination: "Terminations",
      poorPerformanceTermination: "Terminations",
      abscondmentTermination: "Terminations",
      retrenchmentTermination: "Terminations",
      retirementTermination: "Terminations",
      mutualTermination: "Terminations",
      disciplinaryHearingNotice: "Notices",
      incapacityPerformanceHearingNotice: "Notices",
      incapacityIllHealthHearingNotice: "Notices",
      precautionarySuspensionNotice: "Notices",
      contemplatedRetrenchmentNotice: "Notices",
      serviceCertificate: "Other",
      acknowledgementOfDebt: "Other",
    };

    const handleModalState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean; documentKey?: string | null }>;
      const isOpen = Boolean(customEvent.detail?.open);
      const documentKey = customEvent.detail?.documentKey ?? null;
      if (!isOpen || !documentKey) {
        setModalActiveCategory(null);
        return;
      }
      setModalActiveCategory(documentToCategory[documentKey] ?? null);
    };

    window.addEventListener("documents-modal-state", handleModalState as EventListener);
    return () => window.removeEventListener("documents-modal-state", handleModalState as EventListener);
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/documents")) {
      setIsDocumentsSubmenuOpen(false);
      setOpenDocumentCategory(null);
      setActiveFlyoutItemKey(null);
      setModalActiveCategory(null);
      setIsFlyoutPositionReady(false);
    }
  }, [pathname]);

  const positionFlyoutForCategory = (categoryTitle: string) => {
    const anchor = submenuItemRefs.current[categoryTitle];
    const sidebarRoot = sidebarRootRef.current;
    if (!anchor || !sidebarRoot) return false;
    const rect = anchor.getBoundingClientRect();
    const sidebarRect = sidebarRoot.getBoundingClientRect();
    setFlyoutPosition({ top: rect.top, left: sidebarRect.right });
    return true;
  };

  useEffect(() => {
    if (!openDocumentCategory) return;
    const closeFlyout = () => setOpenDocumentCategory(null);
    window.addEventListener("resize", closeFlyout);
    window.addEventListener("scroll", closeFlyout, true);
    return () => {
      window.removeEventListener("resize", closeFlyout);
      window.removeEventListener("scroll", closeFlyout, true);
    };
  }, [openDocumentCategory]);

  const withTooltip = (element: ReactElement, label: string) =>
    isCollapsed ? (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{element}</TooltipTrigger>
          <TooltipContent side="right" className="rounded drop-shadow-md">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      element
    );

  return (
    <Sidebar
      ref={sidebarRootRef}
      collapsible="none"
      className={cn(
        "relative h-full w-full flex flex-col bg-[#2D4256] text-white shadow-sm overflow-visible transition-[width] duration-200",
      )}
    >
      <div className="flex h-full flex-col overflow-x-visible overflow-y-hidden">
        <div
          className={cn(
            "relative flex items-center pt-4 pb-2 mb-4 h-16 overflow-hidden transition-[padding] duration-200 ease-linear",
            isCollapsed ? "px-2 justify-center" : "px-4 justify-start",
          )}
        >
          {!isCollapsed && (
            <img
              src="/llasa_logo_white_horizontal.png"
              alt="LLASA logo"
              className="absolute left-6 top-[53%] h-8 w-auto -translate-y-1/2 object-contain"
              style={{ imageRendering: "crisp-edges" }}
            />
          )}
          {isCollapsed && (
            <img
              src="/llasa_thumbnail.png"
              alt="LLASA thumbnail logo"
              className="absolute left-10 top-[55%] h-8 w-auto -translate-x-1/2 -translate-y-1/2 object-contain"
              style={{ imageRendering: "crisp-edges" }}
            />
          )}
        </div>
        <SidebarContent className="px-0">
          <SidebarGroup className="pt-2 px-0">
            <SidebarGroupLabel className="mt-0 w-full pl-[22px] text-left text-white/70">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {primaryNavItems.map((item) => {
                  const isActive =
                    item.url === "/documents"
                      ? pathname.startsWith("/documents")
                      : item.url === "/case-files"
                        ? pathname.startsWith("/case-files")
                      : location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      {withTooltip(
                        <div>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                              isActive &&
                                "bg-[#010D1A] text-white border-b-2 border-[#3eca44] data-[active=true]:!bg-[#010D1A] [&>svg]:text-white",
                            )}
                            data-collapsed={isCollapsed}
                          >
                            <NavLink
                              to={item.url}
                              className="w-full text-xs"
                              onClick={(event) => {
                                if (item.url === "/documents") {
                                  event.preventDefault();
                                  setIsDocumentsSubmenuOpen((prev) => !prev);
                                  setOpenDocumentCategory(null);
                                  setActiveFlyoutItemKey(null);
                                  setIsFlyoutPositionReady(false);
                                  navigate("/documents");
                                  return;
                                }
                                setIsDocumentsSubmenuOpen(false);
                                setOpenDocumentCategory(null);
                                setActiveFlyoutItemKey(null);
                                setIsFlyoutPositionReady(false);
                              }}
                            >
                              <item.icon className="h-5 w-5" />
                              <span className={cn(isCollapsed && "sr-only")}>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                          {item.url === "/documents" && !isCollapsed && isDocumentsSubmenuOpen ? (
                            <SidebarMenuSub className="ml-7 mr-2 mt-1 gap-0 border-l-white/20">
                              {documentSubmenuItems.map((subItem) => {
                                const subActive = modalActiveCategory === subItem.title;
                                const isFlyoutOpenForItem = openDocumentCategory === subItem.title;
                                return (
                                  <SidebarMenuSubItem
                                    key={subItem.title}
                                    className="relative"
                                    onMouseEnter={() => {
                                      const ready = positionFlyoutForCategory(subItem.title);
                                      setIsFlyoutPositionReady(ready);
                                      setOpenDocumentCategory(subItem.title);
                                    }}
                                    ref={(node) => {
                                      submenuItemRefs.current[subItem.title] = node;
                                    }}
                                  >
                                    <SidebarMenuSubButton
                                      isActive={subActive}
                                      className={cn(
                                        "cursor-pointer text-[11px] text-white/80 transition-all duration-150 hover:bg-transparent hover:text-[11.5px] hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-[#3eca44]",
                                        isFlyoutOpenForItem && !subActive && "text-[11.5px] text-white",
                                      )}
                                    >
                                      <span className="flex w-full items-center justify-between gap-2">
                                        <span>{subItem.title}</span>
                                        <ChevronRight
                                          className={cn(
                                            "h-3.5 w-3.5 text-white/60 transition-colors",
                                            isFlyoutOpenForItem && !subActive && "text-white",
                                            subActive && "text-[#3eca44]",
                                          )}
                                        />
                                      </span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          ) : null}
                        </div>,
                        item.title
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-0 py-4 mt-auto border-t border-white/10">
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                    location.pathname === "/settings" &&
                      "bg-[#010D1A] text-white border-b-2 border-[#3eca44] data-[active=true]:!bg-[#010D1A] [&>svg]:text-white",
                  )}
                  isActive={location.pathname === "/settings"}
                  data-collapsed={isCollapsed}
                >
                  <NavLink to="/settings" state={{ backgroundLocation: location }} className="w-full text-xs">
                    <Settings className="h-5 w-5" />
                    <span className={cn(isCollapsed && "sr-only")}>Settings</span>
                  </NavLink>
                </SidebarMenuButton>,
                "Settings"
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                  )}
                  data-collapsed={isCollapsed}
                >
                  <Bell className="h-5 w-5" />
                  <span className={cn(isCollapsed && "sr-only")}>Notifications</span>
                </SidebarMenuButton>,
                "Notifications"
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "rounded-none px-7 !py-5 text-white text-xs transition-all duration-150 hover:bg-[#010D1A] hover:text-white data-[active=true]:text-white data-[active=true]:[&>svg]:text-white [&>svg]:text-white hover:[&>svg]:text-white",
                  )}
                  data-collapsed={isCollapsed}
                >
                  <Headset className="h-5 w-5" />
                  <span className={cn(isCollapsed && "sr-only")}>Support</span>
                </SidebarMenuButton>,
                "Support"
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              {withTooltip(
                <SidebarMenuButton
                  className={cn(
                    "group rounded-none px-7 !py-5 text-xs text-white underline underline-offset-4 decoration-white transition-all duration-150 hover:bg-[#010D1A] [&>span]:transition-colors [&>span]:duration-150 [&>svg]:transition-colors [&>svg]:duration-150",
                  )}
                  data-collapsed={isCollapsed}
                  onClick={async () => {
                    const { error } = await signOut();
                    if (!error) {
                      navigate("/");
                    }
                  }}
                >
                  <LogOut className="h-5 w-5 text-white" />
                  <span className={cn(isCollapsed && "sr-only", "text-white !underline underline-offset-4 decoration-white")}>
                    Sign out
                  </span>
                </SidebarMenuButton>,
                "Sign out"
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
      {openDocumentCategory && isFlyoutPositionReady && documentFlyoutItems[openDocumentCategory]?.length ? (
        <div
          ref={flyoutRef}
          className="fixed z-50 w-64 rounded-r-sm rounded-l-none border border-l-0 border-white/10 bg-[#2D4256] p-2 shadow-xl"
          style={{ top: flyoutPosition.top - 7, left: flyoutPosition.left }}
        >
          <ul className="space-y-0">
            {documentFlyoutItems[openDocumentCategory].map((flyoutItem) => {
              const flyoutItemKey = `${openDocumentCategory}:${flyoutItem.title}`;
              const isFlyoutActive = activeFlyoutItemKey === flyoutItemKey;
              return (
                <li key={flyoutItem.title}>
                  <NavLink
                    to={flyoutItem.url}
                    onClick={(event) => {
                      setActiveFlyoutItemKey(flyoutItemKey);
                      if (flyoutItem.selectedDocument) {
                        event.preventDefault();
                        navigate("/documents", { state: { selectedDocument: flyoutItem.selectedDocument } });
                      }
                      setOpenDocumentCategory(null);
                    }}
                    className={cn(
                      "flex h-7 items-center rounded-none px-2 text-[10.5px] font-normal leading-none text-white/80 transition-all duration-150 hover:text-[11px] hover:text-white",
                      isFlyoutActive && "text-[#3eca44]",
                    )}
                  >
                    {flyoutItem.title}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Sidebar>
  );
}
