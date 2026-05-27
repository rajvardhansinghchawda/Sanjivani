import React from 'react';
import { motion, useTransform, useMotionValue, animate } from 'framer-motion';
import { AlertTriangle, Activity } from 'lucide-react';
import { FeatureGate } from '@/components/gates/FeatureGate';

export const RiskMeter = ({ riskScore = 0 }) => {
  // SVG Arc constants
  const radius = 80;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // Half-circle
  
  // Motion values for animation
  const scoreAnim = useMotionValue(0);
  
  React.useEffect(() => {
    animate(scoreAnim, riskScore, { 
      duration: 1.5, 
      ease: [0.175, 0.885, 0.32, 1.275] // Spring-like ease
    });
  }, [riskScore]);

  // Color interpolation based on risk score (0-100)
  // 0-30: Green (Low), 31-70: Yellow/Orange (Med), 71-100: Red (High)
  const color = useTransform(
    scoreAnim,
    [0, 30, 70, 100],
    ['#10b981', '#f59e0b', '#f97316', '#ef4444']
  );

  const strokeDashoffset = useTransform(
    scoreAnim,
    [0, 100],
    [circumference, 0]
  );

  return (
    <FeatureGate feature="ai_risk_score">
      <div className="flex flex-col items-center justify-center p-6 bg-card rounded-2xl border border-border shadow-elevation-1">
        <div className="flex w-full justify-between items-center mb-6">
          <h3 className="font-display font-semibold flex items-center text-foreground">
            <Activity className="w-5 h-5 mr-2 text-primary" />
            AI Risk Analysis
          </h3>
          {riskScore > 70 && (
            <span className="flex items-center text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" /> HIGH RISK
            </span>
          )}
        </div>

        {/* Gauge Container */}
        <div className="relative w-48 h-24 overflow-hidden">
          {/* Background Arc */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="text-muted"
            />
            {/* Active Arc */}
            <motion.path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ strokeDashoffset }}
            />
          </svg>

          {/* Needle / Value display */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
            <motion.span 
              className="font-mono text-4xl font-bold tracking-tighter"
              style={{ color }}
            >
              {Math.round(riskScore)}
            </motion.span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Risk Score
            </span>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
};
