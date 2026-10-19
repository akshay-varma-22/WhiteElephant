import About from './components/About.jsx';
import Contact from './components/Contact.jsx';
import CtaBanner from './components/CtaBanner.jsx';
import Footer from './components/Footer.jsx';
import Hero from './components/Hero.jsx';
import Highlights from './components/Highlights.jsx';
import MobileCtaBar from './components/MobileCtaBar.jsx';
import Navbar from './components/Navbar.jsx';
import Portfolio from './components/Portfolio.jsx';
import Process from './components/Process.jsx';
import Services from './components/Services.jsx';
import Testimonials from './components/Testimonials.jsx';
import VideoIntro from './components/VideoIntro.jsx';
import WhyUs from './components/WhyUs.jsx';
import { QuoteProvider } from './components/quotation/QuoteDialog.jsx';

/**
 * Page order (the studio's design): header, hero, video intro, about, key highlights, services, featured projects,
 * why choose us, testimonials (only when real ones exist), quote banner, process, contact, footer.
 * The quotation form is not a section: it is a popup opened by the "Get a Quote" buttons (see quotation/QuoteDialog.jsx).
 */
export default function App() {
  return (
    <QuoteProvider>
      <Navbar />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <VideoIntro />
        <About />
        <Highlights />
        <Services />
        <Portfolio />
        <WhyUs />
        <Testimonials />
        <CtaBanner />
        <Process />
        <Contact />
      </main>
      <Footer />
      <MobileCtaBar />
    </QuoteProvider>
  );
}
