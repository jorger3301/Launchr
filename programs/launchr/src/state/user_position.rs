//! Launchr - User Position State
//! 
//! Tracks individual user positions in token launches.

use anchor_lang::prelude::*;

/// User position in a specific launch
#[account]
#[derive(Default)]
pub struct UserPosition {
    /// Launch this position belongs to
    pub launch: Pubkey,
    
    /// User wallet address
    pub user: Pubkey,
    
    // ========== Token Tracking ==========
    
    /// Total tokens bought by this user
    pub tokens_bought: u64,
    
    /// Total tokens sold by this user
    pub tokens_sold: u64,
    
    /// Current token balance (bought - sold)
    pub token_balance: u64,
    
    // ========== SOL Tracking ==========
    
    /// Total SOL spent on buys
    pub sol_spent: u64,
    
    /// Total SOL received from sells
    pub sol_received: u64,
    
    // ========== Timestamps ==========
    
    /// First trade timestamp
    pub first_trade_at: i64,
    
    /// Last trade timestamp
    pub last_trade_at: i64,
    
    // ========== Trade Counts ==========
    
    /// Number of buy transactions
    pub buy_count: u32,
    
    /// Number of sell transactions
    pub sell_count: u32,
    
    // ========== Cost Basis ==========
    
    /// Average buy price (lamports per token * 1e9)
    pub avg_buy_price: u64,
    
    /// Total cost basis in lamports
    pub cost_basis: u64,
    
    // ========== PDA ==========
    
    /// Bump seed
    pub bump: u8,
    
    /// Reserved for future use
    pub _reserved: [u8; 32],
}

impl UserPosition {
    /// Account space calculation
    pub const LEN: usize = 8 +  // discriminator
        32 +    // launch
        32 +    // user
        8 +     // tokens_bought
        8 +     // tokens_sold
        8 +     // token_balance
        8 +     // sol_spent
        8 +     // sol_received
        8 +     // first_trade_at
        8 +     // last_trade_at
        4 +     // buy_count
        4 +     // sell_count
        8 +     // avg_buy_price
        8 +     // cost_basis
        1 +     // bump
        32;     // reserved
    
    /// Initialize a new position
    pub fn init(
        &mut self,
        launch: Pubkey,
        user: Pubkey,
        bump: u8,
        timestamp: i64,
    ) {
        self.launch = launch;
        self.user = user;
        self.bump = bump;
        self.first_trade_at = timestamp;
        self.last_trade_at = timestamp;
    }
    
    /// Record a buy transaction
    pub fn record_buy(&mut self, tokens: u64, sol_amount: u64, timestamp: i64) {
        // Update totals
        self.tokens_bought = self.tokens_bought.saturating_add(tokens);
        self.token_balance = self.token_balance.saturating_add(tokens);
        self.sol_spent = self.sol_spent.saturating_add(sol_amount);
        
        // Update cost basis and average price
        self.cost_basis = self.cost_basis.saturating_add(sol_amount);
        if self.token_balance > 0 {
            // avg_buy_price = cost_basis / token_balance * 1e9
            self.avg_buy_price = ((self.cost_basis as u128 * 1_000_000_000) / self.token_balance as u128) as u64;
        }
        
        // Update counts and timestamp
        self.buy_count = self.buy_count.saturating_add(1);
        self.last_trade_at = timestamp;
    }
    
    /// Record a sell transaction
    pub fn record_sell(&mut self, tokens: u64, sol_amount: u64, timestamp: i64) {
        // Update totals
        self.tokens_sold = self.tokens_sold.saturating_add(tokens);
        self.token_balance = self.token_balance.saturating_sub(tokens);
        self.sol_received = self.sol_received.saturating_add(sol_amount);
        
        // Reduce cost basis proportionally
        if self.tokens_bought > 0 {
            let sold_ratio = (tokens as u128 * 1_000_000_000) / self.tokens_bought as u128;
            let cost_reduction = ((self.cost_basis as u128 * sold_ratio) / 1_000_000_000) as u64;
            self.cost_basis = self.cost_basis.saturating_sub(cost_reduction);
        }
        
        // Recalculate average price
        if self.token_balance > 0 {
            self.avg_buy_price = ((self.cost_basis as u128 * 1_000_000_000) / self.token_balance as u128) as u64;
        } else {
            self.avg_buy_price = 0;
        }
        
        // Update counts and timestamp
        self.sell_count = self.sell_count.saturating_add(1);
        self.last_trade_at = timestamp;
    }
    
    /// Calculate realized PnL (profit/loss from completed sells)
    pub fn realized_pnl(&self) -> i64 {
        // realized_pnl = sol_received - (sol_spent * tokens_sold / tokens_bought)
        if self.tokens_bought == 0 {
            return 0;
        }
        
        let cost_of_sold = ((self.sol_spent as u128 * self.tokens_sold as u128) / self.tokens_bought as u128) as u64;
        self.sol_received as i64 - cost_of_sold as i64
    }
    
    /// Calculate unrealized PnL at a given price
    pub fn unrealized_pnl(&self, current_price: u64) -> i64 {
        if self.token_balance == 0 {
            return 0;
        }
        
        // current_value = token_balance * current_price / 1e9
        let current_value = ((self.token_balance as u128 * current_price as u128) / 1_000_000_000) as u64;
        
        current_value as i64 - self.cost_basis as i64
    }
    
    /// Calculate total PnL (realized + unrealized)
    pub fn total_pnl(&self, current_price: u64) -> i64 {
        self.realized_pnl() + self.unrealized_pnl(current_price)
    }
    
    /// Calculate ROI percentage (scaled by 100)
    pub fn roi_percent(&self, current_price: u64) -> i64 {
        if self.sol_spent == 0 {
            return 0;
        }
        
        let total_pnl = self.total_pnl(current_price);
        (total_pnl * 10000) / self.sol_spent as i64
    }
    
    /// Check if this is the user's first trade
    pub fn is_new(&self) -> bool {
        self.buy_count == 0 && self.sell_count == 0
    }
    
    /// Get total trade count
    pub fn total_trades(&self) -> u32 {
        self.buy_count.saturating_add(self.sell_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_buy_tracking() {
        let mut pos = UserPosition::default();
        pos.init(Pubkey::new_unique(), Pubkey::new_unique(), 255, 1000);
        
        // Buy 100 tokens for 1 SOL
        pos.record_buy(100_000_000_000, 1_000_000_000, 1001);
        
        assert_eq!(pos.tokens_bought, 100_000_000_000);
        assert_eq!(pos.token_balance, 100_000_000_000);
        assert_eq!(pos.sol_spent, 1_000_000_000);
        assert_eq!(pos.buy_count, 1);
    }
    
    #[test]
    fn test_pnl_calculation() {
        let mut pos = UserPosition::default();
        pos.init(Pubkey::new_unique(), Pubkey::new_unique(), 255, 1000);
        
        // Buy 100 tokens for 1 SOL (price = 0.01 SOL/token)
        pos.record_buy(100_000_000_000, 1_000_000_000, 1001);
        
        // Price doubled to 0.02 SOL/token (20_000_000 lamports per token * 1e9)
        let new_price = 20_000_000u64;
        
        // Unrealized PnL should be ~1 SOL profit
        let pnl = pos.unrealized_pnl(new_price);
        assert!(pnl > 0);
    }
}
