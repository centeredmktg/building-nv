import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Services from "@/components/sections/Services";
import About from "@/components/sections/About";
import Residential from "@/components/sections/Residential";
import Projects from "@/components/sections/Projects";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <About />
        <Residential />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
