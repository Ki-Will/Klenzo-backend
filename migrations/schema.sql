-- Create schemas for each service
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS productivity;
CREATE SCHEMA IF NOT EXISTS habit;
CREATE SCHEMA IF NOT EXISTS insight;
CREATE SCHEMA IF NOT EXISTS notification;

-- Auth Service Schema
CREATE TABLE auth.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Finance Service Schema
CREATE TABLE finance.accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finance.transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    account_id INTEGER REFERENCES finance.accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    description VARCHAR(500),
    category VARCHAR(100),
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('income', 'expense')),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finance.budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    limit_amount DECIMAL(15,2) NOT NULL,
    spent DECIMAL(15,2) DEFAULT 0.00,
    period VARCHAR(50) DEFAULT 'monthly',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Productivity Service Schema
CREATE TABLE productivity.tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productivity.recurring_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    task_id INTEGER REFERENCES productivity.tasks(id),
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly
    next_due DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habit Service Schema
CREATE TABLE habit.habits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly
    target_count INTEGER DEFAULT 1,
    color VARCHAR(7), -- hex color
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE habit.habit_logs (
    id SERIAL PRIMARY KEY,
    habit_id INTEGER REFERENCES habit.habits(id),
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insight Service Schema (for analytics)
CREATE TABLE insight.user_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    insight_type VARCHAR(100) NOT NULL,
    data JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE insight.trends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    category VARCHAR(100),
    period VARCHAR(50), -- weekly, monthly
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Service Schema
CREATE TABLE notification.notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);
