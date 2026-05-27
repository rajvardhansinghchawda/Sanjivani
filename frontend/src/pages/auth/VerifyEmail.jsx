import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authAgent } from '@/agents/auth.agent';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';


const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const token = searchParams.get('token');

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('error');
                setMessage('No verification token provided.');
                return;
            }

            try {
                const response = await authAgent.verifyEmail(token);
                setStatus('success');
                setMessage(response.message || 'Email verified successfully!');
                // Automatically redirect to login after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (error) {
                setStatus('error');
                setMessage(error.message || 'Verification failed. The link may be expired or invalid.');
            }
        };

        verify();
    }, [token, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl border border-border p-10 text-center relative overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mb-12 blur-2xl" />

                <div className="relative z-10">
                    {status === 'verifying' && (
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            </div>
                            <h1 className="text-3xl font-display font-bold text-foreground mb-3">Verifying Account</h1>
                            <p className="text-muted-foreground font-sans">Confirming your clinical credentials with our secure server...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                            <h1 className="text-3xl font-display font-bold text-foreground mb-3">Verified!</h1>
                            <p className="text-muted-foreground font-sans mb-8">{message}</p>
                            
                            <div className="w-full h-1 bg-border rounded-full overflow-hidden mb-8">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 3 }}
                                    className="h-full bg-primary"
                                />
                            </div>

                            <Button onClick={() => navigate('/login')} className="w-full h-14 text-lg">
                                Go to Login
                            </Button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
                                <XCircle className="w-10 h-10 text-destructive" />
                            </div>
                            <h1 className="text-3xl font-display font-bold text-foreground mb-3">Failed</h1>
                            <p className="text-muted-foreground font-sans mb-8">{message}</p>
                            
                            <div className="flex flex-col gap-4 w-full">
                                <Button onClick={() => navigate('/register')} variant="outline" className="h-14 text-lg">
                                    Try Signing Up
                                </Button>
                                <Link to="/login" className="text-primary font-bold hover:underline font-sans text-sm">
                                    Back to Login
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
