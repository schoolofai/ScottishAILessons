import { Header } from "@/components/ui/header";
import { SessionChatAssistant } from "@/components/SessionChatAssistant";
import { RetryPrepopulationProvider } from "@/contexts/RetryPrepopulationContext";

interface SessionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <RetryPrepopulationProvider>
          <SessionChatAssistant sessionId={id} />
        </RetryPrepopulationProvider>
      </main>
    </div>
  );
}