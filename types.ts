export type PayScale = {
    [bps: number]: number[];
};

export interface SalaryInputs {
    bps: number; // Current BPS
    wasPromoted: boolean;
    currentRunningBasicPay: number; // User's current basic pay from latest payslip. Used for 10% ad-hoc and to find the stage.
    
    // --- For promoted employees ---
    // These fields are used to determine the DRA base.
    prePromotionBps: number;
    prePromotionBasicPay2017: number;
}

export interface CalculatedValues {
    basic2017: number; // The base for DRA calculation
    dra: number;
    runningPayIncrease: number;
    totalIncrease: number;
    currentBasicPay: number; // The current running basic pay used for 10% ad-hoc
}