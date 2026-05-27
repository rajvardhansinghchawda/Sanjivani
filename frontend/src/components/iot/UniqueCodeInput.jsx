import { useState, useRef } from 'react';

export const UniqueCodeInput = ({ 
  length = 6, 
  onComplete, 
  error = false 
}) => {
  const [code, setCode] = useState(Array(length).fill(''));
  const inputs = useRef([]);

  const processInput = (e, slot) => {
    const num = e.target.value;
    if (/[^0-9a-zA-Z]/.test(num)) return; // Only allow alphanumeric

    const newCode = [...code];
    newCode[slot] = num.toUpperCase();
    setCode(newCode);

    // Auto-advance
    if (slot !== length - 1 && num !== '') {
      inputs.current[slot + 1].focus();
    }
    
    // Check complete
    if (newCode.every(v => v !== '')) {
      onComplete(newCode.join(''));
    }
  };

  const onKeyUp = (e, slot) => {
    if (e.key === 'Backspace' && !code[slot] && slot !== 0) {
      inputs.current[slot - 1].focus();
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    if (!pastedData) return;

    const newCode = [...code];
    for (let i = 0; i < length; i++) {
      if (i < pastedData.length) {
        newCode[i] = pastedData[i];
      }
    }
    setCode(newCode);

    if (newCode.every(v => v !== '')) {
      onComplete(newCode.join(''));
      inputs.current[length - 1].blur();
    } else {
      const nextEmpty = newCode.findIndex(v => v === '');
      inputs.current[nextEmpty !== -1 ? nextEmpty : length - 1].focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={onPaste}>
      {code.map((num, idx) => (
        <input
          key={idx}
          ref={(ref) => (inputs.current[idx] = ref)}
          type="text"
          inputMode="text"
          maxLength={1}
          value={num}
          onChange={(e) => processInput(e, idx)}
          onKeyUp={(e) => onKeyUp(e, idx)}
          className={`w-12 h-14 text-center text-2xl font-mono font-bold rounded-xl border-2 transition-all outline-none 
            ${error 
              ? 'border-destructive/50 focus:border-destructive text-destructive bg-destructive/5' 
              : 'border-border focus:border-primary text-foreground bg-card shadow-elevation-1'
            }`}
          placeholder="-"
        />
      ))}
    </div>
  );
};
