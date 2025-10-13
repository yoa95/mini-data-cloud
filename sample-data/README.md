# Sample Data

This directory contains sample datasets for testing the Mini Data Cloud system.

## Bank Transactions Dataset

**File**: `bank_transactions.csv`

**Description**: Sample personal banking data with realistic transaction patterns for testing analytics queries.

**Schema**:
- `transaction_id` (STRING): Unique identifier for each transaction
- `date` (DATE): Transaction date in YYYY-MM-DD format
- `amount` (DECIMAL): Transaction amount (negative for expenses, positive for income)
- `category` (STRING): Spending category (groceries, dining, utilities, etc.)
- `description` (STRING): Transaction description
- `account_type` (STRING): Account type (checking, savings, credit)
- `merchant` (STRING): Merchant or payee name

**Sample Queries**:

```sql
-- Monthly spending by category
SELECT 
    category,
    EXTRACT(MONTH FROM date) as month,
    SUM(ABS(amount)) as total_spent
FROM bank_transactions 
WHERE amount < 0
GROUP BY category, EXTRACT(MONTH FROM date)
ORDER BY total_spent DESC;

-- Income vs expenses by month
SELECT 
    EXTRACT(MONTH FROM date) as month,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
FROM bank_transactions
GROUP BY EXTRACT(MONTH FROM date)
ORDER BY month;

-- Top merchants by spending
SELECT 
    merchant,
    COUNT(*) as transaction_count,
    SUM(ABS(amount)) as total_spent
FROM bank_transactions
WHERE amount < 0
GROUP BY merchant
ORDER BY total_spent DESC
LIMIT 10;
```

**Usage**:
1. Load into Mini Data Cloud: `POST /api/v1/tables/bank_transactions/load`
2. Query via REST API or JDBC driver
3. Use for testing distributed query execution across multiple workers

**Data Characteristics**:
- 50 transactions spanning 3 months (Jan-Mar 2024)
- Mix of income (salary, bonus) and expenses across various categories
- Realistic amounts and merchant names
- Perfect for testing aggregations, filtering, and time-based queries