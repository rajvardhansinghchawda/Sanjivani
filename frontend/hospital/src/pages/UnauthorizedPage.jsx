import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Auth } from '../services/auth';
import { staticPageConfig } from '../services/staticPageConfig';

const UnauthorizedPage = () => {
  const user = Auth.user;
  const [errorMsg, setErrorMsg] = useState({
    title: 'Unauthorized',
    message: 'Your account role doesn\'t have access to this portal.',
    primaryAction: 'Go to my portal',
    secondaryAction: 'Sign in with another account',
  });
  const [redirectPath, setRedirectPath] = useState(user ? Auth.redirectPath(user.role) : '/signin');

  useEffect(() => {
    const fetchErrorMessage = async () => {
      try {
        const res = await staticPageConfig.getErrorMessage('unauthorized');
        if (res.success && res.data) {
          setErrorMsg(res.data);
        }
      } catch (error) {
        console.error('Error fetching unauthorized page config:', error);
      }
    };

    const fetchRedirect = async () => {
      if (user && user.role) {
        try {
          const res = await staticPageConfig.getRedirectPath(user.role);
          if (res.success && res.path) {
            setRedirectPath(res.path);
          }
        } catch (error) {
          console.error('Error fetching redirect path:', error);
        }
      }
    };

    fetchErrorMessage();
    fetchRedirect();
  }, [user]);

  return (
    <div className="min-h-screen bg-[#EBF5FB] flex items-center justify-center px-6" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-xl bg-white rounded-[48px] p-12 border border-[#D5D8DC] shadow-xl">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#566573]">Access</div>
        <h1 className="text-4xl font-black text-[#0D1B2A] mt-3">{errorMsg.title}</h1>
        <p className="text-sm font-bold text-[#566573] mt-4">
          {errorMsg.message}
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to={redirectPath}
            className="block text-center w-full py-4 rounded-2xl font-black text-white bg-[#1B4F72] hover:bg-[#2471A3] transition-all"
          >
            {errorMsg.primaryAction}
          </Link>
          <Link
            to="/signin"
            className="block text-center w-full py-4 rounded-2xl font-black text-[#0D1B2A] bg-[#EBF5FB] border border-[#D5D8DC] hover:bg-white transition-all"
          >
            {errorMsg.secondaryAction}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;

