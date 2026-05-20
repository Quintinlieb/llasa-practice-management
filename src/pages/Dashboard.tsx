import DashboardLayout from "@/components/DashboardLayout";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="-m-6 min-h-[calc(100dvh-var(--app-header-height,5rem))] bg-[#f3f4f6]" />
    </DashboardLayout>
  );
}
