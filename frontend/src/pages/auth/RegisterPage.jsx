import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShieldCheck, Stethoscope, ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authAgent } from '@/agents/auth.agent';

const RoleCard = ({ icon: Icon, title, selected, onClick }) => (
  <button 
    type="button"
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border transition-all 
      ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50 bg-card'}`}
  >
    <Icon className={`w-6 h-6 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
    <span className={`text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>{title}</span>
  </button>
);

export default function RegisterPage() {
  const [role, setRole] = useState('PATIENT');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const payload = {
      email,
      password,
      full_name: `${firstName} ${lastName}`.trim(),
      phone_number: phone,
      role
    };

    try {
      await authAgent.register(payload);
      alert('Account created! You can now sign in with your credentials.');
      navigate('/login');
    } catch (error) {
      alert(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Right: Illustration/Brand */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center p-24">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[32rem] h-[32rem] bg-white rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
        
        <div className="relative z-10 text-white max-w-lg">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8">
            <Heart className="w-8 h-8 fill-white" />
          </div>
          <h2 className="text-5xl font-display font-extrabold mb-6 leading-tight">Start Your <br/>Journey Today.</h2>
          <p className="text-xl text-primary-foreground/80 leading-relaxed font-sans">
            Become part of India's most trusted adherence network and take control of your clinical schedule.
          </p>
        </div>
      </div>

      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 overflow-y-auto">
        <div className="w-full max-w-md flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center lg:text-left">
            <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-display font-bold text-lg">A</div>
              <span className="font-display font-bold text-xl text-primary">Aarogyam</span>
            </div>
            <h1 className="text-4xl font-display font-bold text-foreground">Create Account</h1>
            <p className="text-muted-foreground font-sans">Choose your role and provide your clinical details.</p>
          </div>

          <div className="flex gap-4">
            <RoleCard icon={User} title="Patient" selected={role === 'PATIENT'} onClick={() => setRole('PATIENT')} />
            <RoleCard icon={ShieldCheck} title="Caregiver" selected={role === 'CAREGIVER'} onClick={() => setRole('CAREGIVER')} />
            <RoleCard icon={Stethoscope} title="Doctor" selected={role === 'DOCTOR'} onClick={() => setRole('DOCTOR')} />
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-6">
            {/* Common Fields */}
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="First Name" 
                placeholder="Aarav" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                required 
              />
              <Input 
                label="Last Name" 
                placeholder="Sharma" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                required 
              />
            </div>
            <Input 
              label="Email Address" 
              type="email" 
              placeholder="aarav@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <Input 
              label="Phone Number" 
              placeholder="+91 XXXXX XXXXX" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              required 
            />

            {/* Role Specific Fields */}
            {role === 'PATIENT' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Age" type="number" placeholder="45" required />
                  <Input label="Gender" placeholder="Male/Female/Other" />
                </div>
                <Input label="Chronic Condition" placeholder="e.g. Type 2 Diabetes" />
                <Input label="Linked Doctor ID" placeholder="DOC-123 (Optional)" />
              </motion.div>
            )}

            {role === 'CAREGIVER' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <Input label="Relationship to Patient" placeholder="e.g. Son, Daughter, Spouse" required />
                <Input label="Patient's Email/ID" placeholder="The patient you are caring for" required />
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-[13px] text-primary leading-relaxed">
                  <strong>Note:</strong> We will send a link request to this patient. You can start monitoring once they approve.
                </div>
              </motion.div>
            )}

            {role === 'DOCTOR' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <Input label="Specialization" placeholder="e.g. Cardiologist" required />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Medical License No." placeholder="MC-XXXXX" required />
                  <Input label="Years of Experience" type="number" placeholder="10" />
                </div>
                <Input label="Clinic/Hospital Name" placeholder="AIIMS Delhi" required />
              </motion.div>
            )}

            <Input 
              label="Password" 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />

            <Button isLoading={isLoading} className="h-14 text-lg mt-2">
              Create Account <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm font-sans">
            Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
