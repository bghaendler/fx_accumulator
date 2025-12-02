import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
import pandas as pd
import numpy as np
import logging
from typing import List, Optional

# 1. Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 2. Initialize App
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Data Models
class StructureType(str, Enum):
    ACCUMULATOR = "Accumulator"
    DECUMULATOR = "Decumulator"

class Frequency(str, Enum):
    DAILY = "Daily"
    WEEKLY = "Weekly"
    MONTHLY = "Monthly"

class SolveTarget(str, Enum):
    STRIKE = "strike_price"
    BARRIER = "ko_price"
    LEVERAGE = "leverage"

class SimulationRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    product_type: StructureType
    frequency: Frequency
    strike_price: float
    ko_price: float
    notional: float
    leverage: float
    gearing_limit: int

class ValuationRequest(BaseModel):
    spot_price: float
    strike_price: float
    ko_price: float
    volatility: float 
    risk_free_rate: float
    days_to_expiry: int
    notional: float
    leverage: float
    gearing_limit: int
    product_type: StructureType
    frequency: Frequency

class SolveRequest(ValuationRequest):
    target_param: SolveTarget

# 4. Helpers
def get_schedule(start_str, end_str, freq) -> List[str]:
    """Generates a sorted list of date strings (YYYY-MM-DD) for fixings."""
    start = pd.Timestamp(start_str)
    end = pd.Timestamp(end_str)
    
    if freq == Frequency.DAILY:
        dates = pd.bdate_range(start, end)
    elif freq == Frequency.WEEKLY:
        dates = pd.date_range(start, end, freq='W-FRI')
        dates = dates[dates <= end]
    elif freq == Frequency.MONTHLY:
        dates = pd.date_range(start, end, freq='BM')
        dates = dates[dates <= end]
    else:
        return []
    return [d.strftime("%Y-%m-%d") for d in dates]

def monte_carlo_pricer(S0, K, H, T, r, sigma, notional, leverage, gearing_limit, product_type, frequency, num_sims=2000):
    """
    Reduced num_sims default for speed in solver loops.
    Returns: (NPV, Probability_of_KnockOut)
    """
    if T <= 0: return 0.0, 0.0
    
    num_steps = int(T * 252) 
    if num_steps < 1: num_steps = 1
    dt = T / num_steps
    
    step_interval = 1
    if frequency == Frequency.WEEKLY: step_interval = 5
    if frequency == Frequency.MONTHLY: step_interval = 21

    Z = np.random.normal(0, 1, (num_sims, num_steps))
    S = np.zeros((num_sims, num_steps + 1))
    S[:, 0] = S0
    
    # Path Evolution
    for t in range(1, num_steps + 1):
        S[:, t] = S[:, t-1] * np.exp((r - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z[:, t-1])

    payoffs = np.zeros(num_sims)
    ko_count = 0
    
    for i in range(num_sims):
        path = S[i]
        total_pnl = 0
        fixing_counter = 0
        path_knocked_out = False
        
        # Check Barrier (Continuous approximation)
        if product_type == StructureType.ACCUMULATOR:
            if np.any(path >= H):
                path_knocked_out = True
                ko_idx = np.argmax(path >= H)
                path = path[:ko_idx+1]
        else:
            if np.any(path <= H):
                path_knocked_out = True
                ko_idx = np.argmax(path <= H)
                path = path[:ko_idx+1]
        
        if path_knocked_out: ko_count += 1

        # Calculate Payoff
        for t in range(step_interval, len(path), step_interval):
            spot = path[t]
            fixing_counter += 1
            
            current_leverage = leverage if fixing_counter <= gearing_limit else 1.0
            daily_pnl = 0
            
            if product_type == StructureType.ACCUMULATOR:
                # Client Buys Base
                if spot < K: daily_pnl = (spot - K) * notional * current_leverage
                else: daily_pnl = (spot - K) * notional
            else:
                # Client Sells Base
                if spot > K: daily_pnl = (K - spot) * notional * current_leverage
                else: daily_pnl = (K - spot) * notional
            
            total_pnl += daily_pnl * np.exp(-r * (t * dt))
        
        payoffs[i] = total_pnl

    npv = np.mean(payoffs)
    prob_ko = (ko_count / num_sims) * 100.0
    return npv, prob_ko

# 5. Endpoints

@app.post("/solve")
async def solve_structure(req: SolveRequest):
    """
    Iteratively solves for the target parameter to make NPV ~= 0
    """
    logger.info(f"Solving for {req.target_param}")
    
    T = req.days_to_expiry / 365.0
    S0 = req.spot_price
    
    # Define the pricing wrapper
    def get_npv(val):
        # Create dynamic args
        k = val if req.target_param == SolveTarget.STRIKE else req.strike_price
        h = val if req.target_param == SolveTarget.BARRIER else req.ko_price
        lev = val if req.target_param == SolveTarget.LEVERAGE else req.leverage
        
        npv, _ = monte_carlo_pricer(S0, k, h, T, req.risk_free_rate, req.volatility, req.notional, lev, req.gearing_limit, req.product_type, req.frequency, num_sims=2000)
        return npv

    # Define bounds for Binary Search
    low, high = 0.0, 0.0
    
    if req.target_param == SolveTarget.LEVERAGE:
        low, high = 0.0, 100.0 # Leverage range
    elif req.target_param == SolveTarget.STRIKE:
        low, high = S0 * 0.5, S0 * 1.5
    elif req.target_param == SolveTarget.BARRIER:
        low, high = S0 * 0.5, S0 * 1.5

    # Binary Search (Bisection Method)
    iterations = 0
    final_val = 0.0
    
    # Pre-check bounds to ensure sign change (IVT requirement for Bisection)
    # If not crossing zero, we just return the best bound.
    npv_low = get_npv(low)
    npv_high = get_npv(high)
    
    # Heuristic: If signs are same, we can't solve perfectly, return close edge
    if np.sign(npv_low) == np.sign(npv_high):
        # Fail-safe: Just return current value if unsolvable
        return {"solved_value": req.leverage if req.target_param == SolveTarget.LEVERAGE else req.strike_price}

    while iterations < 15: # Max 15 steps for speed
        mid = (low + high) / 2
        npv_mid = get_npv(mid)
        
        if abs(npv_mid) < (req.notional * 0.001): # Convergence threshold
            final_val = mid
            break
        
        if np.sign(npv_mid) == np.sign(npv_low):
            low = mid
        else:
            high = mid
            
        final_val = mid
        iterations += 1
        
    return {"solved_value": final_val, "residual_npv": get_npv(final_val)}


@app.post("/valuation")
async def calculate_valuation(req: ValuationRequest):
    try:
        T = req.days_to_expiry / 365.0
        S0 = req.spot_price
        
        def run_pricer_npv(spot_val, vol_val, rate_val, time_val):
            val, _ = monte_carlo_pricer(spot_val, req.strike_price, req.ko_price, time_val, rate_val, vol_val, req.notional, req.leverage, req.gearing_limit, req.product_type, req.frequency)
            return val

        npv, prob_ko = monte_carlo_pricer(S0, req.strike_price, req.ko_price, T, req.risk_free_rate, req.volatility, req.notional, req.leverage, req.gearing_limit, req.product_type, req.frequency, num_sims=5000)
        
        dS = S0 * 0.01
        p_up = run_pricer_npv(S0 + dS, req.volatility, req.risk_free_rate, T)
        p_down = run_pricer_npv(S0 - dS, req.volatility, req.risk_free_rate, T)
        delta = (p_up - p_down) / (2 * dS)
        gamma = (p_up - 2*npv + p_down) / (dS ** 2)
        
        dVol = 0.01
        p_vol_up = run_pricer_npv(S0, req.volatility + dVol, req.risk_free_rate, T)
        vega = (p_vol_up - npv) / 100 
        
        T_new = max(0, T - (1/365.0))
        p_theta = run_pricer_npv(S0, req.volatility, req.risk_free_rate, T_new)
        theta = (p_theta - npv)
        
        dr = 0.01
        p_rho = run_pricer_npv(S0, req.volatility, req.risk_free_rate + dr, T)
        rho = (p_rho - npv) / 100

        scenarios = []
        for pct in [-10, -5, 0, 5, 10]:
            shock = S0 * (1 + pct/100)
            val = run_pricer_npv(shock, req.volatility, req.risk_free_rate, T)
            scenarios.append({"spot_pct": pct, "estimated_pnl": round(val, 2)})

        return {
            "npv": round(npv, 2),
            "prob_ko": round(prob_ko, 1),
            "greeks": { "delta": round(delta, 2), "gamma": round(gamma, 6), "vega": round(vega, 2), "theta": round(theta, 2), "rho": round(rho, 2) },
            "payoff_scenario": scenarios
        }
    except Exception as e:
        logger.error(f"Val Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/structure")
async def get_structure_details(req: SimulationRequest):
    try:
        fixing_dates = get_schedule(req.start_date, req.end_date, req.frequency)
        structure = []
        is_acc = req.product_type == StructureType.ACCUMULATOR
        
        for i, date_str in enumerate(fixing_dates):
            is_geared = (i + 1) <= req.gearing_limit
            risk_mult = req.leverage if is_geared else 1.0
            
            leg1 = { "side": "Long", "type": "Call" if is_acc else "Put", "strike": req.strike_price, "barrier": req.ko_price, "notional": req.notional }
            leg2 = { "side": "Short", "type": "Put" if is_acc else "Call", "strike": req.strike_price, "barrier": req.ko_price, "notional": req.notional * risk_mult }

            structure.append({
                "fixing_id": i + 1,
                "date": date_str,
                "days_to_expiry": 0,
                "geared": is_geared,
                "leg_1": leg1,
                "leg_2": leg2
            })
        return structure
    except Exception as e:
        logger.error(f"Structure Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate")
async def simulate_structure(req: SimulationRequest):
    logger.info(f"Simulate: {req.ticker} Freq: {req.frequency}")
    try:
        ticker_obj = yf.Ticker(req.ticker)
        df = ticker_obj.history(start=req.start_date, end=req.end_date)
        if df.empty: df = yf.download(req.ticker, start=req.start_date, end=req.end_date, progress=False)
        if df.empty: raise HTTPException(status_code=404, detail=f"No data found for {req.ticker}")
        if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
        df.columns = [c.capitalize() for c in df.columns]

        fixing_list = get_schedule(req.start_date, req.end_date, req.frequency)
        fixing_set = set(fixing_list)
        
        simulation_data = []
        total_pnl = 0
        total_units = 0
        knocked_out = False
        ko_date = None
        fixing_counter = 0

        for date, row in df.iterrows():
            date_str = date.strftime("%Y-%m-%d")
            spot = float(row['Close'])
            daily_pnl, daily_units, chart_pnl = 0, 0, None
            action = "Hold"

            if knocked_out:
                simulation_data.append({"date": date_str, "spot": spot, "strike": req.strike_price, "ko": req.ko_price, "pnl": 0, "chart_pnl": None, "cumulative_pnl": total_pnl, "units": 0, "action": "Terminated"})
                continue

            is_ko = (req.product_type == StructureType.ACCUMULATOR and spot >= req.ko_price) or \
                    (req.product_type == StructureType.DECUMULATOR and spot <= req.ko_price)
            
            if is_ko:
                knocked_out = True
                ko_date = date_str
                action = "Knock Out"
            
            elif date_str in fixing_set:
                fixing_counter += 1
                is_geared = fixing_counter <= req.gearing_limit
                cur_lev = req.leverage if is_geared else 1.0
                amount = req.notional
                
                if req.product_type == StructureType.ACCUMULATOR:
                    if spot < req.strike_price:
                        amount = req.notional * cur_lev
                        action = f"Accumulate ({cur_lev}x)"
                    else:
                        action = "Accumulate (1x)"
                    # P&L = units * (execution_price - strike_price) / execution_price
                    # For buying base currency: profit when spot > strike
                    daily_pnl = amount * ((spot - req.strike_price) / spot)
                    daily_units = amount
                else:
                    if spot > req.strike_price:
                        amount = req.notional * cur_lev
                        action = f"Decumulate ({cur_lev}x)"
                    else:
                        action = "Decumulate (1x)"
                    # For selling base currency: profit when strike > spot  
                    daily_pnl = amount * ((req.strike_price - spot) / spot)
                    daily_units = -amount
                chart_pnl = round(daily_pnl, 2)

            total_pnl += daily_pnl
            total_units += daily_units
            simulation_data.append({"date": date_str, "spot": round(spot, 5), "strike": req.strike_price, "ko": req.ko_price, "pnl": round(daily_pnl, 2), "chart_pnl": chart_pnl, "cumulative_pnl": round(total_pnl, 2), "units": daily_units, "action": action})

        return { "summary": { "final_pnl": round(total_pnl, 2), "total_accumulated_value": round(total_units, 2), "status": "Knocked Out" if knocked_out else "Expired", "ko_date": ko_date, "product_type": req.product_type }, "chart_data": simulation_data }
    except Exception as e:
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/spot")
async def get_spot_price(ticker: str):
    try:
        ticker_obj = yf.Ticker(ticker)
        # Fast fetch of current price
        df = ticker_obj.history(period="1d")
        if df.empty:
             # Fallback for some tickers
            df = yf.download(ticker, period="1d", progress=False)
            
        if df.empty: 
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
            
        current_spot = float(df['Close'].iloc[-1])
        return {"ticker": ticker, "spot": round(current_spot, 5), "date": str(df.index[-1].date())}
    except Exception as e:
        logger.error(f"Spot Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)