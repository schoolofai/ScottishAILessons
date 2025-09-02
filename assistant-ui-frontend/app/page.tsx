import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Features />
      
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto text-center text-gray-600">
          <p>&copy; 2024 Scottish AI Lessons. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
