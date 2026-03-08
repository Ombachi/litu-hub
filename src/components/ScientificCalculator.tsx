import { useState, useCallback } from "react";
import { X, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

const ScientificCalculator = () => {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [isRadians, setIsRadians] = useState(true);
  const [memory, setMemory] = useState(0);

  const toAngle = useCallback((v: number) => isRadians ? v : (v * Math.PI) / 180, [isRadians]);

  const calculate = useCallback((expr: string): string => {
    try {
      // Replace math functions
      let e = expr
        .replace(/π/g, String(Math.PI))
        .replace(/e(?![x])/g, String(Math.E))
        .replace(/sin\(([^)]+)\)/g, (_, a) => String(Math.sin(toAngle(eval(a)))))
        .replace(/cos\(([^)]+)\)/g, (_, a) => String(Math.cos(toAngle(eval(a)))))
        .replace(/tan\(([^)]+)\)/g, (_, a) => String(Math.tan(toAngle(eval(a)))))
        .replace(/asin\(([^)]+)\)/g, (_, a) => String(Math.asin(eval(a))))
        .replace(/acos\(([^)]+)\)/g, (_, a) => String(Math.acos(eval(a))))
        .replace(/atan\(([^)]+)\)/g, (_, a) => String(Math.atan(eval(a))))
        .replace(/ln\(([^)]+)\)/g, (_, a) => String(Math.log(eval(a))))
        .replace(/log\(([^)]+)\)/g, (_, a) => String(Math.log10(eval(a))))
        .replace(/sqrt\(([^)]+)\)/g, (_, a) => String(Math.sqrt(eval(a))))
        .replace(/abs\(([^)]+)\)/g, (_, a) => String(Math.abs(eval(a))))
        .replace(/(\d+)!/g, (_, n) => { let r = 1; for (let i = 2; i <= +n; i++) r *= i; return String(r); })
        .replace(/\^/g, "**");
      const result = Function(`"use strict"; return (${e})`)();
      if (typeof result !== "number" || !isFinite(result)) return "Error";
      return parseFloat(result.toPrecision(12)).toString();
    } catch {
      return "Error";
    }
  }, [toAngle]);

  const press = (val: string) => {
    if (val === "C") { setDisplay("0"); setExpression(""); return; }
    if (val === "CE") { setDisplay("0"); return; }
    if (val === "=") {
      const full = expression + display;
      const result = calculate(full);
      setDisplay(result);
      setExpression("");
      return;
    }
    if (val === "±") { setDisplay(d => d.startsWith("-") ? d.slice(1) : "-" + d); return; }
    if (val === "MC") { setMemory(0); return; }
    if (val === "MR") { setDisplay(String(memory)); return; }
    if (val === "M+") { setMemory(m => m + parseFloat(display) || 0); return; }
    if (val === "M-") { setMemory(m => m - parseFloat(display) || 0); return; }

    // Functions that wrap
    const fns = ["sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "sqrt", "abs"];
    if (fns.includes(val)) {
      setExpression(e => e + display);
      setDisplay(val + "(");
      return;
    }
    if (val === "π" || val === "e") { setDisplay(val); return; }
    if (val === "x²") { setDisplay(d => calculate(d + "^2")); return; }
    if (val === "x³") { setDisplay(d => calculate(d + "^3")); return; }
    if (val === "1/x") { setDisplay(d => calculate("1/(" + d + ")")); return; }
    if (val === "n!") { setDisplay(d => calculate(d + "!")); return; }
    if (val === "(") { setExpression(e => e + "("); return; }
    if (val === ")") { setExpression(e => e + display + ")"); setDisplay("0"); return; }

    // Operators
    if (["+", "-", "×", "÷", "^"].includes(val)) {
      const op = val === "×" ? "*" : val === "÷" ? "/" : val;
      setExpression(e => e + display + op);
      setDisplay("0");
      return;
    }

    // Numbers and decimal
    if (val === ".") {
      if (!display.includes(".")) setDisplay(d => d + ".");
      return;
    }
    setDisplay(d => d === "0" || d === "Error" ? val : d + val);
  };

  const btnClass = (type: "num" | "op" | "fn" | "eq" | "mem") =>
    cn("rounded-lg text-sm font-medium h-9 transition-colors active:scale-95",
      type === "num" && "bg-card border hover:bg-secondary",
      type === "op" && "bg-primary/10 text-primary border hover:bg-primary/20",
      type === "fn" && "bg-secondary text-foreground border hover:bg-secondary/80 text-xs",
      type === "eq" && "bg-primary text-primary-foreground hover:bg-primary/90",
      type === "mem" && "bg-accent/10 text-accent border hover:bg-accent/20 text-xs",
    );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        title="Scientific Calculator"
      >
        <Calculator className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Calculator</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border bg-background shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Scientific Calculator</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsRadians(!isRadians)} className="text-[10px] px-2 py-0.5 rounded border bg-secondary">
            {isRadians ? "RAD" : "DEG"}
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Display */}
      <div className="px-4 py-3 border-b">
        <div className="text-xs text-muted-foreground h-4 text-right truncate">{expression}</div>
        <div className="text-2xl font-mono font-bold text-right truncate">{display}</div>
      </div>

      {/* Buttons */}
      <div className="p-2 space-y-1.5">
        {/* Memory row */}
        <div className="grid grid-cols-5 gap-1">
          {["MC", "MR", "M+", "M-"].map(b => (
            <button key={b} onClick={() => press(b)} className={btnClass("mem")}>{b}</button>
          ))}
          <button onClick={() => press("C")} className={cn(btnClass("op"), "text-destructive")}>{display === "0" ? "C" : "CE"}</button>
        </div>
        {/* Scientific row 1 */}
        <div className="grid grid-cols-5 gap-1">
          {["sin", "cos", "tan", "π", "e"].map(b => (
            <button key={b} onClick={() => press(b)} className={btnClass("fn")}>{b}</button>
          ))}
        </div>
        {/* Scientific row 2 */}
        <div className="grid grid-cols-5 gap-1">
          {["asin", "acos", "atan", "ln", "log"].map(b => (
            <button key={b} onClick={() => press(b)} className={btnClass("fn")}>{b}</button>
          ))}
        </div>
        {/* Scientific row 3 */}
        <div className="grid grid-cols-5 gap-1">
          {["x²", "x³", "sqrt", "n!", "1/x"].map(b => (
            <button key={b} onClick={() => press(b)} className={btnClass("fn")}>{b}</button>
          ))}
        </div>
        {/* Main pad */}
        <div className="grid grid-cols-5 gap-1">
          {["(", ")", "^", "÷", "CE"].map(b => (
            <button key={b} onClick={() => press(b)} className={btnClass("op")}>{b}</button>
          ))}
        </div>
        {[
          ["7", "8", "9", "×", "±"],
          ["4", "5", "6", "-", "%"],
          ["1", "2", "3", "+", "="],
        ].map((row, ri) => (
          <div key={ri} className="grid grid-cols-5 gap-1">
            {row.map(b => (
              <button key={b} onClick={() => press(b === "%" ? "/" : b)} className={b === "=" ? btnClass("eq") : ["+", "-", "×", "±", "%"].includes(b) ? btnClass("op") : btnClass("num")}>{b}</button>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-5 gap-1">
          <button onClick={() => press("0")} className={cn(btnClass("num"), "col-span-2")}>0</button>
          <button onClick={() => press(".")} className={btnClass("num")}>.</button>
          <button onClick={() => press("=")} className={cn(btnClass("eq"), "col-span-2")}>=</button>
        </div>
      </div>
    </div>
  );
};

export default ScientificCalculator;
