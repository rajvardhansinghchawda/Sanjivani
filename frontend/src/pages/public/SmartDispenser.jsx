import { useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Pill, ArrowLeft, ShoppingBag, CheckCircle, Star, Shield,
  Wifi, Bell, Battery, Smartphone, Clock, BarChart3,
  ChevronDown, ChevronUp, Zap, Heart, Package, Truck
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRef } from 'react';

import logoMedicine from '@/assets/logo medicine.png';

import dispenserImg from '@/assets/pill_dispenser_system.png';

const FadeIn = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }} className={className}
    >{children}</motion.div>
  );
};

const specs = [
  { icon: Battery, label: 'Battery Life', value: '30 Days' },
  { icon: Wifi, label: 'Connectivity', value: 'WiFi + BLE 5.0' },
  { icon: Pill, label: 'Compartments', value: '7 Days × 4 Slots' },
  { icon: Bell, label: 'Alerts', value: 'LED + Buzzer + App' },
  { icon: Shield, label: 'Build', value: 'Medical-Grade ABS' },
  { icon: Clock, label: 'Sync Interval', value: 'Real-Time' },
];

const features = [
  { icon: Zap, title: 'Auto Dose Detection', desc: 'IR sensors detect when a compartment is opened, logging doses automatically without any button press.' },
  { icon: Wifi, title: 'Cloud Connected', desc: 'Syncs with Aarogyam app via WiFi. Works offline too — queues data and syncs when back online.' },
  { icon: Bell, title: 'Multi-Alert System', desc: 'LED ring glows, buzzer sounds, and app notification fires simultaneously at scheduled dose times.' },
  { icon: Heart, title: 'Caregiver Alerts', desc: 'Missed dose? Caregivers get instant WhatsApp/SMS alerts with patient name and medication details.' },
  { icon: BarChart3, title: 'AI Risk Scoring', desc: 'Combined with app data, the dispenser feeds the AI engine to predict non-adherence risk in real-time.' },
  { icon: Shield, title: 'Tamper-Proof Lock', desc: 'Optional child-safety lock prevents accidental access. Unlock via app or fingerprint sensor.' },
];

const faqs = [
  { q: 'How do I set up the Smart Dispenser?', a: 'Simply plug it in, download the Aarogyam app, and scan the QR code on the bottom of the device. Setup takes under 2 minutes.' },
  { q: 'Does it work without WiFi?', a: 'Yes! The dispenser stores up to 7 days of dose data locally and syncs automatically when WiFi is restored.' },
  { q: 'Can multiple family members use one dispenser?', a: 'Each dispenser is linked to one patient profile. For multiple patients, we recommend one dispenser per person.' },
  { q: 'What is the warranty policy?', a: 'All dispensers come with a 1-year manufacturer warranty covering hardware defects. Extended 2-year warranty available with Premium plan.' },
  { q: 'Is the dispenser compatible with all medications?', a: 'The compartments fit most standard pills and capsules. Liquid medications are not supported.' },
];

const FAQ = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-foreground text-[15px] pr-4">{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-primary flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed">{a}</p>
      </motion.div>
    </div>
  );
};

export default function SmartDispenser() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> <span className="text-sm font-semibold">Back to Home</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src={logoMedicine} alt="Aarogyam Logo" className="w-9 h-9 object-contain" />
            <span className="font-display font-bold text-lg text-primary">Aarogyam</span>
          </Link>
          <a href="#pricing">
            <Button className="h-10 text-sm shadow-lg shadow-primary/20">Buy Now</Button>
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-16 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-bold mb-6">
              <Package className="w-4 h-4" /> New Hardware Product
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-[1.1] mb-5">
              Aarogyam <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Smart Dispenser</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              A WiFi-connected, AI-powered pill dispenser that automatically tracks doses,
              alerts caregivers on missed medications, and syncs seamlessly with the Aarogyam app.
            </p>
            <div className="flex flex-wrap gap-4 mb-8">
              <a href="#pricing"><Button className="h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20">
                <ShoppingBag className="w-5 h-5 mr-2" /> Order Now — ₹2,999
              </Button></a>
              <a href="#features"><Button variant="outline" className="h-14 px-8 text-lg rounded-2xl">
                Explore Features
              </Button></a>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-primary" /> Free Delivery</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> 1-Year Warranty</span>
              <span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-accent fill-accent" /> 4.8/5 Rating</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="relative">
              <div className="aspect-square max-w-xl mx-auto rounded-3xl bg-gradient-to-br from-primary/5 via-secondary to-accent/5 border border-border/40 flex items-center justify-center overflow-hidden">
                <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative px-8"
                >
                  <img 
                    src={dispenserImg} 
                    alt="Aarogyam Smart Dispenser System" 
                    className="w-full h-auto drop-shadow-[0_20px_50px_rgba(11,110,122,0.3)]"
                  />
                  
                  {/* Floating Tech Badges */}
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-0 -right-4 w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/30 border-4 border-background z-10"
                  >
                    <Wifi className="w-6 h-6 text-white" />
                  </motion.div>
                  <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                    className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 border-4 border-background z-10"
                  >
                    <CheckCircle className="w-6 h-6 text-white" />
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Specs Bar */}
      <section className="bg-gradient-to-r from-primary via-primary/95 to-primary/85 py-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {specs.map((s, i) => (
            <FadeIn key={i} delay={i * 0.05} className="text-center text-white">
              <s.icon className="w-6 h-6 mx-auto mb-2 text-white/70" />
              <p className="font-bold text-lg">{s.value}</p>
              <p className="text-white/50 text-xs uppercase tracking-wider">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-primary font-bold text-sm uppercase tracking-widest">Features</span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold mt-3">
              Engineered for <span className="text-primary">Perfect Adherence</span>
            </h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <motion.div whileHover={{ y: -6 }}
                  className="p-7 bg-card rounded-2xl border border-border/60 shadow-elevation-1 hover:shadow-elevation-3 transition-shadow"
                >
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-primary mb-4">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* What's in the Box */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-primary font-bold text-sm uppercase tracking-widest">Package</span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold mt-3">What's in the Box</h2>
          </FadeIn>
          <FadeIn>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Package, item: 'Smart Dispenser Unit' },
                { icon: Zap, item: 'USB-C Charging Cable' },
                { icon: Smartphone, item: 'Quick Start Guide' },
                { icon: Shield, item: 'Warranty Card' },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-3 p-6 bg-card rounded-2xl border border-border/60 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <b.icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{b.item}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-primary font-bold text-sm uppercase tracking-widest">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold mt-3">
              Choose Your <span className="text-primary">Plan</span>
            </h2>
            <p className="text-muted-foreground mt-3">One-time hardware cost + optional subscription for advanced features.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Dispenser Only', price: '₹2,999', period: 'one-time', highlight: false,
                items: ['7-day × 4-slot dispenser', 'LED + Buzzer alerts', 'Bluetooth connectivity', 'Basic app integration', 'Free delivery'],
              },
              {
                name: 'Dispenser + Freemium', price: '₹3,499', period: 'one-time + ₹99/mo', highlight: true,
                items: ['Everything in Dispenser Only', 'WiFi cloud sync', 'WhatsApp + SMS alerts', 'AI Risk Score', 'Caregiver notifications', 'Weekly AI insights'],
              },
              {
                name: 'Dispenser + Premium', price: '₹4,499', period: 'one-time + ₹299/mo', highlight: false,
                items: ['Everything in Freemium', 'Real-time AI insights', 'Voice call reminders', 'Auto pharmacy refill', 'Geofence reminders', '2-year extended warranty'],
              },
            ].map((plan, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6 }}
                  className={`relative p-8 rounded-3xl border-2 flex flex-col gap-6 ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-primary/5 to-primary/10 border-primary shadow-elevation-3 shadow-primary/10'
                      : 'bg-card border-border/60 shadow-elevation-1'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-white text-xs font-bold rounded-full uppercase tracking-wider">
                      Best Value
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-display font-bold">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-display font-extrabold">{plan.price}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{plan.period}</p>
                  </div>
                  <ul className="flex flex-col gap-3 flex-1">
                    {plan.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-foreground/80">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                  <Button variant={plan.highlight ? 'primary' : 'outline'} className="w-full h-12">
                    <ShoppingBag className="w-4 h-4 mr-1.5" /> Buy Now
                  </Button>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-primary font-bold text-sm uppercase tracking-widest">Reviews</span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold mt-3">What Users Say</h2>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { q: 'Setup was incredibly easy. Scanned the QR code and it connected in seconds. My mother loves the buzzer reminders!', a: 'Priya S.', r: 'Caregiver, Mumbai' },
              { q: 'The build quality is premium. 30-day battery life is no joke — I charge it once a month. Highly recommend.', a: 'Dr. Arun V.', r: 'Physician, Chennai' },
              { q: 'Getting WhatsApp alerts when my grandfather misses a dose gives our whole family peace of mind.', a: 'Rohan M.', r: 'Family Caregiver, Delhi' },
            ].map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-6 bg-card rounded-2xl border border-border/60 flex flex-col gap-4">
                  <div className="flex gap-1">{[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-accent text-accent" />)}</div>
                  <p className="text-foreground/80 italic text-sm leading-relaxed">"{t.q}"</p>
                  <div className="mt-auto">
                    <p className="font-bold text-sm">{t.a}</p>
                    <p className="text-xs text-muted-foreground">{t.r}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-primary font-bold text-sm uppercase tracking-widest">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold mt-3">Frequently Asked Questions</h2>
          </FadeIn>
          <FadeIn>
            <div className="flex flex-col gap-3">
              {faqs.map((f, i) => <FAQ key={i} {...f} />)}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <FadeIn>
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-12 text-center relative overflow-hidden shadow-2xl shadow-primary/20">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-4">
                Ready to Automate Your Health?
              </h2>
              <p className="text-white/70 text-lg mb-8 max-w-md mx-auto">
                Order the Aarogyam Smart Dispenser today and never worry about missed doses again.
              </p>
              <Button className="h-14 px-10 text-lg rounded-2xl bg-white text-primary hover:bg-white/90 font-bold shadow-xl">
                <ShoppingBag className="w-5 h-5 mr-2" /> Order Now — ₹2,999
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-sm text-muted-foreground">
        © 2026 Aarogyam Health Systems India Pvt Ltd. All rights reserved.
      </footer>
    </div>
  );
}
