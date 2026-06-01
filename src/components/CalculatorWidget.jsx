import { useState } from 'react';
import { Delete } from 'lucide-react';

const BUTTONS = [
  ['C', '%', '⌫', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '=', '='],
];

export default function CalculatorWidget({ onCalculate, onClose }) {
  const [display, setDisplay] = useState('0');
  const [operator, setOperator] = useState(null);
  const [prev, setPrev] = useState(null);
  const [overwrite, setOverwrite] = useState(true);

  const handleDigit = (d) => {
    if (d === '.' && display.includes('.')) return;
    if (overwrite) {
      setDisplay(d === '.' ? '0.' : String(d));
      setOverwrite(false);
    } else {
      setDisplay(display === '0' && d !== '.' ? String(d) : display + d);
    }
  };

  const handleOp = (op) => {
    const current = parseFloat(display);
    if (operator && !overwrite) {
      const result = calculate(prev, current, operator);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(current);
    }
    setOperator(op);
    setOverwrite(true);
  };

  const calculate = (a, b, op) => {
    switch (op) {
      case '+': return parseFloat((a + b).toFixed(10));
      case '-': return parseFloat((a - b).toFixed(10));
      case '*': return parseFloat((a * b).toFixed(10));
      case '/': return b !== 0 ? parseFloat((a / b).toFixed(10)) : 0;
      default: return b;
    }
  };

  const handlePercent = () => {
    const val = parseFloat(display);
    if (operator && prev !== null) {
      // e.g. 1000 + 16% → 1000 + (1000 * 0.16)
      const pctVal = parseFloat(((prev * val) / 100).toFixed(10));
      setDisplay(String(pctVal));
    } else {
      setDisplay(String(parseFloat((val / 100).toFixed(10))));
    }
    setOverwrite(true);
  };

  const handleEquals = () => {
    if (!operator || prev === null) {
      onCalculate(parseFloat(display));
      return;
    }
    const result = calculate(prev, parseFloat(display), operator);
    setDisplay(String(result));
    setOperator(null);
    setPrev(null);
    setOverwrite(true);
    onCalculate(result);
  };

  const handleClear = () => {
    setDisplay('0');
    setOperator(null);
    setPrev(null);
    setOverwrite(true);
  };

  const handleBackspace = () => {
    if (overwrite || display.length <= 1) {
      setDisplay('0');
      setOverwrite(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleButton = (btn) => {
    if (btn === 'C') return handleClear();
    if (btn === '⌫') return handleBackspace();
    if (btn === '%') return handlePercent();
    if (btn === '=') return handleEquals();
    if (['+', '-', '*', '/'].includes(btn)) return handleOp(btn);
    handleDigit(btn);
  };

  const btnStyle = (btn) => {
    if (btn === '=') return 'bg-primary text-primary-foreground font-bold';
    if (['+', '-', '*', '/'].includes(btn)) return 'bg-primary/15 text-primary font-semibold';
    if (btn === 'C') return 'bg-destructive/10 text-destructive font-semibold';
    if (btn === '%') return 'bg-primary/10 text-primary font-semibold';
    if (btn === '⌫') return 'bg-muted text-muted-foreground';
    return 'bg-muted text-foreground font-medium';
  };

  // Render display: show expression context
  const displayLabel = operator && prev !== null
    ? `${prev} ${operator}`
    : '';

  return (
    <div className="mt-2 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
      {/* Display */}
      <div className="px-4 py-3 bg-muted/50 text-right">
        {displayLabel && (
          <p className="text-[11px] text-muted-foreground font-mono h-4">{displayLabel}</p>
        )}
        <p className="text-2xl font-bold text-foreground font-mono leading-tight truncate">{display}</p>
      </div>

      {/* Buttons grid */}
      <div className="grid grid-cols-4 gap-0.5 bg-border p-0.5">
        {[
          ['C', '%', '⌫', '/'],
          ['7', '8', '9', '*'],
          ['4', '5', '6', '-'],
          ['1', '2', '3', '+'],
          ['0', '.', '='],
        ].map((row, ri) =>
          row.map((btn, ci) => (
            <button
              key={`${ri}-${ci}`}
              onClick={() => handleButton(btn)}
              className={`${btnStyle(btn)} ${btn === '0' ? 'col-span-2' : ''} ${btn === '=' && ri === 4 ? '' : ''} h-12 text-sm rounded-sm transition-colors active:scale-95 hover:brightness-95`}
            >
              {btn === '⌫' ? <Delete className="w-4 h-4 mx-auto" /> : btn}
            </button>
          ))
        )}
      </div>

      {/* Use result button */}
      <div className="p-2">
        <button
          onClick={() => { onCalculate(parseFloat(display)); onClose?.(); }}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Usar resultado: {parseFloat(display).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
        </button>
      </div>
    </div>
  );
}