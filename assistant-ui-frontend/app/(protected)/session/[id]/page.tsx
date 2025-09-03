import { Header } from "@/components/ui/header";
import { SessionChatAssistant } from "@/components/SessionChatAssistant";

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
        <SessionChatAssistant sessionId={id} />
      </main>
    </div>
  );
}