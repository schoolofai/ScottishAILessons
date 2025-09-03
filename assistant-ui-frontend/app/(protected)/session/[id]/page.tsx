import { Header } from "@/components/ui/header";
import { LessonRunner } from "@/components/lesson/LessonRunner";

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
        <LessonRunner sessionId={id} />
      </main>
    </div>
  );
}