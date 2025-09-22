import { Header } from "@/components/ui/header";
import { EnhancedStudentDashboard } from "@/components/dashboard/EnhancedStudentDashboard";

export default function DashboardPage() {
  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <EnhancedStudentDashboard />
      </main>
    </div>
  );
}