import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { SQALevels } from "@/components/landing/SQALevels";
import { NewFeatures } from "@/components/landing/NewFeatures";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--wizard-bg-white)' }}
    >
      <Navbar />
      <Hero />
      <SQALevels />
      <NewFeatures />
      <Features />
      <Footer />
    </div>
  );
}
