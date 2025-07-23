
import React, { useState, useCallback, ChangeEvent, useEffect } from 'react';
import { PAY_SCALE_2017, PAY_SCALE_2022, BPS_OPTIONS } from './constants';
import { SalaryInputs, CalculatedValues } from './types';

// --- Helper Functions ---
const formatCurrency = (amount: number): string => {
    if (isNaN(amount)) amount = 0;
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount).replace('Rs', 'PKR');
};

const calculateEnhancements = (inputs: SalaryInputs, stage: number | null): CalculatedValues | null => {
    let basic2017 = 0; // This is the base for DRA
    const currentBasicPay = inputs.currentRunningBasicPay;

    if (inputs.wasPromoted) {
        // For promoted employees, DRA base is the manually entered 2017 pay.
        // We need to look up the 2017 pay based on their PRE-PROMOTION BPS and the entered 2017 pay.
        // This confirms the entered value is somewhat valid, though we'll primarily use the user's input.
        const payScale2017ForBps = PAY_SCALE_2017[inputs.prePromotionBps];
        if (!payScale2017ForBps) return null;
        // We use the user's direct input as the source of truth for promoted cases.
        basic2017 = inputs.prePromotionBasicPay2017;

    } else {
        // For non-promoted, a valid stage must have been found.
        if (stage === null) return null;
        
        const stageIndex = stage;
        const payScale2017ForBps = PAY_SCALE_2017[inputs.bps];

        if (!payScale2017ForBps || stageIndex < 0 || stageIndex >= payScale2017ForBps.length) {
            return null; // Invalid BPS or Stage for DRA calculation
        }
        
        basic2017 = payScale2017ForBps[stageIndex];
    }

    if (basic2017 <= 0 || currentBasicPay <= 0) {
        return null; // Could not determine valid pay.
    }
    
    const dra = basic2017 * 0.30;
    const runningPayIncrease = currentBasicPay * 0.10;
    const totalIncrease = dra + runningPayIncrease;

    return { basic2017, dra, runningPayIncrease, totalIncrease, currentBasicPay };
};


// --- UI Helper Components ---
const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

interface TooltipProps {
    text: string;
    children: React.ReactNode;
}
const Tooltip: React.FC<TooltipProps> = ({ text, children }) => (
    <div className="relative flex items-center group">
        {children}
        <div className="absolute bottom-full left-1/2 z-20 w-64 p-3 mb-2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            {text}
            <svg className="absolute left-1/2 -translate-x-1/2 top-full" width="16" height="8" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 8L0 0H16L8 8Z" fill="#1e293b"/>
                <path d="M1 0.5L8 7.5L15 0.5" stroke="#475569" strokeLinecap="round"/>
            </svg>
        </div>
    </div>
);


interface InputGroupProps {
    label: string;
    tooltipText: string;
    children: React.ReactNode;
}
const InputGroup: React.FC<InputGroupProps> = ({ label, tooltipText, children }) => (
    <div className="mb-6">
        <label className="flex items-center space-x-2 mb-2 text-sm font-medium text-slate-300">
            <span>{label}</span>
            <Tooltip text={tooltipText}>
                <span className="flex items-center justify-center w-5 h-5 bg-slate-600 rounded-full cursor-help">
                    <InfoIcon />
                </span>
            </Tooltip>
        </label>
        {children}
    </div>
);

interface ResultRowProps {
    label: string;
    value: string;
    isTotal?: boolean;
    tooltipText?: string;
    isSubtle?: boolean;
}
const ResultRow: React.FC<ResultRowProps> = ({ label, value, isTotal = false, tooltipText, isSubtle = false }) => {
    const baseClasses = "flex justify-between items-center p-4 rounded-lg transition-all duration-300";
    const normalClasses = "bg-slate-700/50 hover:bg-slate-700/80";
    const totalClasses = "bg-blue-600/20 border border-blue-500 hover:bg-blue-600/30";

    const labelClasses = isSubtle ? "text-slate-400" : "text-slate-300";
    const valueClasses = "font-bold text-lg";

    const totalLabelClasses = "text-blue-300";
    const totalValueClasses = "text-blue-300 text-xl";

    return (
        <div className={`${baseClasses} ${isTotal ? totalClasses : normalClasses}`}>
            <div className="flex items-center space-x-2">
                <span className={isTotal ? totalLabelClasses : labelClasses}>{label}</span>
                {tooltipText && (
                    <Tooltip text={tooltipText}>
                        <span className="flex items-center justify-center w-5 h-5 bg-slate-600 rounded-full cursor-help">
                            <InfoIcon />
                        </span>
                    </Tooltip>
                )}
            </div>
            <span className={`${valueClasses} ${isTotal ? totalValueClasses : "text-white"}`}>{value}</span>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [inputs, setInputs] = useState<SalaryInputs>({
        bps: 16,
        wasPromoted: false,
        prePromotionBps: 15,
        prePromotionBasicPay2017: 24100,
        currentRunningBasicPay: 47700, // PAY_SCALE_2022[16][9] (Stage 10)
    });
    const [results, setResults] = useState<CalculatedValues | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundStage, setFoundStage] = useState<number | null>(null);

    // Effect to auto-detect stage from running basic pay
    useEffect(() => {
        if (inputs.wasPromoted) {
            setFoundStage(null);
            setError(null);
            return;
        }

        if (inputs.currentRunningBasicPay > 0 && inputs.bps > 0) {
            const payScale2022ForBps = PAY_SCALE_2022[inputs.bps];
            if (!payScale2022ForBps) {
                 setFoundStage(null);
                 setError("Invalid BPS selected.");
                 return;
            }

            // If pay is less than the starting pay for the BPS, it's an error.
            if (inputs.currentRunningBasicPay < payScale2022ForBps[0]) {
                setFoundStage(null);
                setError(`Basic pay for BPS-${inputs.bps} must be at least ${formatCurrency(payScale2022ForBps[0])}.`);
                return;
            }
            
            // New Logic: Find the highest stage where the user's pay is >= the stage's value.
            // This is more robust than an exact match.
            let detectedStageIndex = -1;
            for (let i = payScale2022ForBps.length - 1; i >= 0; i--) {
                if (inputs.currentRunningBasicPay >= payScale2022ForBps[i]) {
                    detectedStageIndex = i;
                    break;
                }
            }

            if (detectedStageIndex !== -1) {
                setFoundStage(detectedStageIndex);
                setError(null); // Clear previous errors
            } else {
                // This case should not be reached due to the check above, but it's a safe fallback.
                setFoundStage(null);
                setError("Could not determine a stage for the entered basic pay.");
            }
        } else {
            setFoundStage(null);
            setError(null);
        }
    }, [inputs.bps, inputs.currentRunningBasicPay, inputs.wasPromoted]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
    
        setInputs(prev => {
            const newInputs = { ...prev };
    
            if (type === 'checkbox') {
                const { checked } = e.target as HTMLInputElement;
                newInputs.wasPromoted = checked;
            } else {
                const parsedValue = parseInt(value, 10);
                (newInputs as any)[name] = isNaN(parsedValue) ? 0 : parsedValue;
            }
    
            return newInputs;
        });
    
        setResults(null); // Clear previous results on input change
    };

    const handleCalculate = useCallback(() => {
        setIsLoading(true);
        setResults(null);
        
        // Use a fresh error check instead of relying on state for the click handler
        let calculationError: string | null = null;
        if (inputs.wasPromoted) {
            if (inputs.prePromotionBasicPay2017 <= 0 || inputs.currentRunningBasicPay <= 0) {
                 calculationError = "For promoted cases, please enter positive, non-zero values for all pay fields.";
            }
        } else {
             if (foundStage === null) {
                calculationError = "Could not calculate. The entered basic pay does not correspond to a valid stage.";
             }
        }
        
        if (error || calculationError) {
            setError(error || calculationError);
            setIsLoading(false);
            return;
        }

        setTimeout(() => {
            const calculated = calculateEnhancements(inputs, foundStage);
            if (calculated) {
                setResults(calculated);
                setError(null);
            } else {
                setError("Could not calculate. Please verify all your inputs are correct and positive values.");
            }
            setIsLoading(false);
        }, 500);
    }, [inputs, foundStage, error]);
    
    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.2),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(30,64,175,0.15),transparent_30%)] -z-10"></div>
            
            <header className="text-center my-8">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 pb-2">
                    Salary Calculator
                </h1>
                <p className="text-slate-400 text-lg">2025-26 Budget Enhancement Estimates</p>
            </header>

            <main className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <section className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950/50 flex flex-col">
                    <h2 className="text-2xl font-bold mb-6 text-blue-400">Enter Your Details</h2>
                    <div className="flex-grow">
                       <InputGroup label="Current BPS" tooltipText="Select your current official Basic Pay Scale.">
                            <select name="bps" value={inputs.bps} onChange={handleInputChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
                                {BPS_OPTIONS.map(bps => <option key={bps} value={bps}>BPS - {bps}</option>)}
                            </select>
                        </InputGroup>

                        {!inputs.wasPromoted && (
                            <>
                                <InputGroup label="Current Running Basic Pay (PKR)" tooltipText="Enter your current basic pay from your latest payslip. The calculator will find your stage automatically.">
                                    <input
                                        type="number"
                                        name="currentRunningBasicPay"
                                        value={inputs.currentRunningBasicPay === 0 ? '' : inputs.currentRunningBasicPay}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 47700"
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </InputGroup>
                                {foundStage !== null && !error && (
                                    <div className="text-sm text-center text-green-300 bg-green-900/40 p-3 rounded-lg mb-6 -mt-2 transition-all duration-300">
                                        ✅ Base Stage Detected: <span className="font-bold">{foundStage + 1}</span> (from 2022 Revised Pay Scale)
                                    </div>
                                )}
                            </>
                        )}
                        
                        <div className="bg-slate-900/50 p-4 rounded-lg my-6">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="wasPromoted"
                                    checked={inputs.wasPromoted}
                                    onChange={handleInputChange}
                                    className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 ring-offset-gray-800 focus:ring-2"
                                />
                                <div className="flex flex-col">
                                    <span className="text-slate-200 font-medium">I was promoted after 30.06.2022.</span>
                                    <span className="text-slate-400 text-xs">Check this to enter pre-promotion details manually.</span>
                                </div>
                            </label>

                            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${inputs.wasPromoted ? 'max-h-96 opacity-100 pt-4 mt-4 border-t border-slate-700' : 'max-h-0 opacity-0'}`}>
                                {inputs.wasPromoted && (
                                    <>
                                        <InputGroup label="BPS on 30.06.2022" tooltipText="Select your BPS BEFORE promotion (as of the 2017 pay scale).">
                                            <select name="prePromotionBps" value={inputs.prePromotionBps} onChange={handleInputChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
                                                {BPS_OPTIONS.map(bps => <option key={bps} value={bps}>BPS - {bps}</option>)}
                                            </select>
                                        </InputGroup>
                                        <InputGroup label="Basic Pay on 30.06.2022 (PKR)" tooltipText="Enter your basic pay amount BEFORE promotion (on the 2017 scale). The 30% DRA is calculated on this value.">
                                            <input
                                                type="number"
                                                name="prePromotionBasicPay2017"
                                                value={inputs.prePromotionBasicPay2017 === 0 ? '' : inputs.prePromotionBasicPay2017}
                                                onChange={handleInputChange}
                                                placeholder="e.g., 24100"
                                                className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                            />
                                        </InputGroup>
                                         <InputGroup label="Current Running Basic Pay (PKR)" tooltipText="Enter your current basic pay from your latest payslip after your promotion.">
                                            <input
                                                type="number"
                                                name="currentRunningBasicPay"
                                                value={inputs.currentRunningBasicPay === 0 ? '' : inputs.currentRunningBasicPay}
                                                onChange={handleInputChange}
                                                placeholder="e.g., 51740"
                                                className="w-full bg-slate-700/50 border border-slate-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                            />
                                        </InputGroup>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleCalculate} disabled={isLoading || !!error} className="w-full mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100">
                        {isLoading ? 'Calculating...' : 'Calculate Increase'}
                    </button>
                </section>

                {/* Results Section */}
                <section className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950/50">
                     <h2 className="text-2xl font-bold mb-6 text-blue-400">Calculated Results</h2>
                     <div className={`space-y-4 transition-opacity duration-500 ${isLoading ? 'opacity-50 animate-pulse' : ''} ${!results && !isLoading && !error ? 'opacity-50' : 'opacity-100'}`}>
                        {error && (
                            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
                                <p className="font-bold">Input Error</p>
                                <p className="text-sm mt-1">{error}</p>
                            </div>
                        )}
                        
                        {results ? (
                            <>
                                <ResultRow 
                                    label="Current Running Basic Pay" 
                                    value={formatCurrency(results.currentBasicPay)}
                                    tooltipText="Your current basic pay, used for the 10% ad-hoc increase."
                                    isSubtle
                                />
                                <ResultRow 
                                    label="Basic Pay on 30.06.2022 (for DRA)" 
                                    value={formatCurrency(results.basic2017)}
                                    tooltipText="This is the base pay used for the DRA calculation. For non-promoted staff, it's derived from your detected stage on the 2017 scale. For promoted staff, it's your manually entered pre-promotion pay."
                                    isSubtle
                                />
                                <ResultRow 
                                    label="30% Disparity Reduction Allowance" 
                                    value={formatCurrency(results.dra)}
                                    tooltipText="Calculated as 30% of your 'Basic Pay on 30.06.2022'."
                                />
                                <ResultRow 
                                    label="10% Ad-hoc on Running Pay" 
                                    value={formatCurrency(results.runningPayIncrease)}
                                    tooltipText="Calculated as 10% of your 'Current Running Basic Pay'."
                                />
                                <div className="pt-2">
                                <ResultRow 
                                    label="Total Estimated Increase" 
                                    value={formatCurrency(results.totalIncrease)}
                                    isTotal
                                    tooltipText="The sum of the 30% DRA and the 10% Ad-hoc increase."
                                />
                                </div>
                            </>
                        ) : (
                           !error && (
                               <div className="text-center text-slate-400 py-10">
                                   <p>Enter your details and click "Calculate Increase" to see your results.</p>
                               </div>
                           )
                        )}
                     </div>
                </section>
            </main>

            <footer className="w-full max-w-5xl mx-auto mt-8 p-6 bg-yellow-600/10 border border-yellow-500/30 rounded-lg text-center">
                <p className="text-yellow-300 text-sm font-semibold">⚠️ Disclaimer</p>
                <p className="text-yellow-400 text-xs mt-2 leading-relaxed">
                    This calculator provides estimates increased based on federal budget 2025-26 announcements. All calculations are for informational purposes only. For official salary figures, please consult your department's accounts section.
                </p>
            </footer>
        </div>
    );
}
