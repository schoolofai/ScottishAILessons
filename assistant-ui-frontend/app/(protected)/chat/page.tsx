import { MyAssistant } from "@/components/MyAssistant";
import { Header } from "@/components/ui/header";

export default function ChatPage() {
  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <MyAssistant />
      </main>
    </div>
  );
}