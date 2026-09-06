# Nebula Kirana — AI-Powered Supermarket Operations Agent

> A production-oriented AI agent for running Indian kirana store operations through a single Telegram conversation.

Nebula Kirana is a conversational supermarket operations system that combines **AI agent orchestration, backend engineering, database persistence, deterministic business logic, financial calculations, transactional safety, and document automation** into one Telegram-based product.

Instead of building separate dashboards and forms for inventory, billing, customer credit, analytics, and reporting, the store owner interacts with the system using natural language.

```text
Store Owner
     │
     ▼
 Telegram
     │
     ▼
 AI Agent (gemini)
     │
     ▼
 Tool Orchestration
     │
 ┌───┼────────┬──────────┬──────────┐
 ▼   ▼        ▼          ▼          ▼
Stock Billing Khata   Analytics   Memory
 │     │       │          │          │
 └─────┴───────┴──────────┴──────────┘
                 │
                 ▼
              SQLite
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Invoice PDF        Analysis PPTX
        │                 │
        └────────┬────────┘
                 ▼
              Telegram
```

## Why This Project

This project focuses on solving a real business workflow rather than building a simple chatbot.

The system demonstrates:

* AI agent and tool orchestration
* Natural-language business workflows
* Backend application development
* SQL database design
* Transaction-safe operations
* Inventory consistency
* Financial calculation correctness
* GST and HSN handling
* Customer credit management
* Idempotency
* Persistent application state
* PDF and PowerPoint generation
* Telegram API integration
* Secure environment configuration

The core engineering principle is:

> **The model orchestrates. The tools enforce. The database persists.**

---

# Key Capabilities

## AI Agent

The application uses Claude (Anthropic Messages API, native tool use) to understand natural-language requests and select the appropriate tools.

Example:

```text
"make a bill: 2kg sugar, 1 aashirvaad atta, 4 maggi, upi"
```

The agent determines that it needs to:

1. Identify the requested products against the live product catalog
2. Create a draft bill
3. Add each requested line item (checking stock as it goes)
4. Compute the running GST-inclusive total
5. Wait for further edits or confirmation
6. Finalize the transaction (idempotently)
7. Decrement inventory atomically
8. Offer to generate an invoice

The application does not rely on a large regex or `if/else` intent router. There are 19 narrow tools; the model decides which to call and in what order, chaining multiple calls in a single turn.

---

# Inventory Management

The inventory system supports:

* Product creation
* Product listing
* Stock queries
* Stock receiving
* Low-stock detection
* Reorder levels
* Cost price
* Selling price
* MRP
* GST rate
* HSN code
* Multiple units
* Loose and packaged products

Supported units include:

```text
kg
g
litre
ml
packet
dozen
piece
```

Sample seeded inventory:

```text
Aashirvaad Atta 5kg
Tata Salt 1kg
Amul Butter 100g
Fortune Sunflower Oil 1L
Maggi 70g
Parle-G
Surf Excel 1kg
Loose Sugar
Loose Rice
Loose Toor Dal
```

Example commands:

```text
what do we have?
what's running out?
how much maggi is left?
50 packets of maggi came in, cost 12, mrp 14
```

---

# Conversational Billing

Billing is implemented as a controlled multi-step workflow rather than a single database insert.

```text
START BILL
  │
  ▼
DRAFT
  │
  ├── add_bill_item
  ├── remove_bill_item
  └── (re-add with new qty to edit)
  │
  ▼
UPDATED DRAFT
  │
  ▼
VALIDATE (oversell + below-cost)
  │
  ▼
FINALIZE
  │
  ▼
STOCK UPDATE
  │
  ▼
INVOICE
```

Example:

```text
make a bill: 2kg sugar, 1 aashirvaad atta, 4 maggi
```

Every bill line tracks:

* Product
* Quantity
* Unit
* Unit price (snapshot at billing time)
* Cost price
* GST rate
* HSN code
* Taxable amount
* CGST
* SGST
* Line total

---

# Draft Bill Safety

Stock is **not deducted when a draft bill is created**.

Stock is deducted only after successful finalization, inside the same transaction as the final oversell check.

This allows the owner to freely edit the bill without touching real inventory.

Example:

```text
make a bill: 2kg sugar, 1 atta, 4 maggi, 1 amul butter
drop the butter, make it 6 maggi
```

Only after `finalize_bill` does the inventory transaction take place.

---

# Oversell Protection

The billing layer validates stock **twice**: a soft check when a line is added (fast feedback), and an authoritative check at finalize time, inside the same write-locked transaction as the decrement.

```text
Requested Quantity
        │
        ▼
Available Stock (re-read inside txn)
        │
    ┌───┴────┐
    │        │
 Enough   Insufficient
    │        │
    ▼        ▼
 Continue   Reject (ToolError)
```

The model cannot simply decide that a sale is valid — the tool re-checks the actual row in SQLite immediately before committing the decrement, so two bills racing for the last unit can never both succeed.

---

# Transaction-Safe Finalization

Critical billing operations run inside a single SQLite `BEGIN IMMEDIATE … COMMIT` block.

```text
BEGIN IMMEDIATE
       │
       ├── Re-fetch bill + all line items
       ├── Validate stock per line (oversell guard)
       ├── Validate price ≥ cost (below-cost guard)
       ├── Decrement stock + write stock_ledger rows
       ├── Compute GST totals
       ├── Mark bill finalized
       ├── Post to khata (if payment_mode = credit)
       └── Cache result under idempotency_key
                │
                ▼
             COMMIT
```

If any guard fails, the whole block rolls back — no partial stock deduction, no half-finalized bill.

---

# GST & Financial Calculations

GST is calculated per bill item from the product's own configured GST rate and HSN code — never invented by the model.

```text
Sell Price (tax-inclusive) × Qty
     │
     ▼
Taxable Value = Amount × 100 / (100 + GST%)
     │
     ▼
 ┌───┴───┐
 ▼       ▼
CGST    SGST      (GST% / 2 each, intra-state)
 │       │
 └───┬───┘
     ▼
 Total GST
     │
     ▼
 Line Total (rounded to paise)
```

Slabs used: loose staples 0%, packaged staples 5%, packaged FMCG 12–18%, matching real Indian GST practice for a kirana store.

---

# Payments

Supported payment modes:

```text
Cash
UPI
Card
Credit (khata)
```

Payment references can also be recorded.

Example:

```text
bill it, upi, ref UPI123456
```

No real payment gateway is connected. Payment information is recorded as part of the store transaction.

---

# Khata / Customer Credit

The system includes a customer credit ledger.

It supports:

* Customer lookup (auto-created on first credit entry)
* Credit entries (direct, or automatically from a `credit`-mode bill)
* Payment entries (with an overpay guard)
* Outstanding balance
* Full ledger history

Examples:

```text
put ₹500 on ramesh's credit
ramesh's balance?
ramesh paid ₹300
```

All ledger entries are persisted in SQLite; a payment against a non-existent account or over the balance is refused by the tool, not the prompt.

---

# Daily Close

The daily-close workflow summarizes store activity for a given date.

It includes:

* Number of bills
* Total sales
* GST collected
* Cash / UPI / Card / Credit split
* Top-selling items

Example:

```text
close the day
today's sales?
```

---

# Sales Analysis

Sales analysis is generated from persisted business data — never from model memory.

Example:

```text
make this week's sales analysis deck
```

The analytics layer reads actual bills, bill items, and stock rows from SQLite before charting anything.

---

# Invoice PDF Automation

The application generates real invoice PDFs using **ReportLab**.

Generated invoices include:

* Shop name
* GSTIN
* Bill number
* Date
* Customer (if tagged)
* Product, HSN, quantity, unit, rate
* Per-line taxable value, CGST, SGST
* Tax totals + grand total
* Payment mode / reference

Example:

```text
send that as a pdf
```

The generated PDF is sent back to the owner as a Telegram document.

---

# PowerPoint Analysis Automation

The application generates a PowerPoint sales analysis deck using **python-pptx**, with real native charts (not screenshots):

* Daily sales trend (line chart)
* Top items by revenue (bar chart)
* Payment-mode mix (pie chart)
* Stock-health / reorder slide

Example:

```text
generate the analysis deck
```

The deck is generated from live store data and delivered directly through Telegram.

---

# Persistent Memory

The system stores shop preferences in SQLite, completely outside the conversation window.

Example:

```text
always use upi unless i say cash
shop name is Nebula Kirana Store
```

```text
User
 │
 ▼
AI Agent
 │
 ▼
set_preference tool
 │
 ▼
SQLite (preferences table)
 │
 ▼
Read fresh every turn — survives /new
```

Starting `/new` clears only the in-memory conversation history; stock, bills, khata, and preferences are untouched.

---

# Telegram Idempotency

Telegram updates are tracked to prevent duplicate processing.

```text
Telegram Update
      │
      ▼
Check update_id in processed_updates
      │
 ┌────┴────┐
 ▼         ▼
Existing   New
 │         │
 ▼         ▼
Ignore    Process + store update_id
```

Independently, `finalize_bill` accepts an `idempotency_key`; a retried finalize call with the same key replays the cached result instead of re-decrementing stock. Two independent layers — either one alone prevents a double-bill.

---

# Architecture

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         STORE OWNER                          │
│                                                               │
│                 Natural Language Telegram                    │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 TELEGRAM / python-telegram-bot                │
│                                                               │
│  Receive messages • Identify chat • Send responses/files      │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         AI AGENT                              │
│                                                               │
│              Anthropic Messages API + Tool Use                │
│                    (Claude Sonnet 4.6)                        │
│                                                               │
│  Observe → Decide → Tool Call → Observe Result → Respond      │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                       DOMAIN TOOLS (19)                        │
│                                                               │
│ Inventory │ Billing │ Khata │ Daily-Close │ Memory │ Docs      │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLITE DATABASE (WAL mode)                 │
│                                                               │
│ products • bills • bill_items • stock_ledger                  │
│ khata_customers • khata_transactions • preferences             │
│ processed_updates • idempotency_keys                           │
└──────────────────────────────┬──────────────────────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
           ┌──────────────┐            ┌──────────────┐
           │  ReportLab   │            │ python-pptx  │
           │ Invoice PDF  │            │ Analysis PPTX│
           └──────┬───────┘            └──────┬───────┘
                  │                           │
                  └─────────────┬─────────────┘
                                ▼
                            Telegram
```

---

# Agent Control Flow

```text
User Message
     │
     ▼
Claude (system prompt + 19 tool schemas + chat history)
     │
     ▼
Tool Selection (one or many, chained)
     │
     ▼
Tool Execution → tools.py / documents.py
     │
     ▼
SQLite Transaction (BEGIN IMMEDIATE … COMMIT)
     │
     ▼
Tool Result (JSON) fed back to Claude
     │
     ▼
Claude decides: call another tool, or respond
     │
     ▼
Final Natural-Language Reply (+ attached files)
```

The model handles reasoning and orchestration.
The tool layer handles deterministic business logic.
The database is the single source of truth for persistent business state.

---

# Separation of Responsibilities

```text
┌──────────────────────────────┐
│          AI AGENT             │
│                                │
│ Understand request             │
│ Select tools                   │
│ Orchestrate multi-step workflow│
│ Ask clarification when ambiguous│
│ Explain results in plain text   │
└──────────────┬────────────────┘
               │
               ▼
┌──────────────────────────────┐
│       BUSINESS TOOLS          │
│                                │
│ Validate inputs                │
│ Enforce oversell guard          │
│ Enforce below-cost guard        │
│ Calculate GST                   │
│ Execute atomic transactions     │
│ Enforce khata validity           │
└──────────────┬────────────────┘
               │
               ▼
┌──────────────────────────────┐
│          DATABASE              │
│                                │
│ Persistent state                │
│ WAL + BEGIN IMMEDIATE txns      │
│ Foreign keys & constraints       │
│ Idempotency keys                 │
└──────────────────────────────┘
```

This prevents critical business decisions from ever depending entirely on language-model output.

---

# Database Design

The project uses **SQLite** via Python's built-in `sqlite3`, in WAL mode.

Main tables:

```text
products
bills
bill_items
stock_ledger
khata_customers
khata_transactions
preferences
processed_updates
idempotency_keys
```

Core relationships:

```text
products
   │
   ├──────────► bill_items ──────────► bills
   │
   └──────────► stock_ledger

khata_customers
   │
   └──────────► khata_transactions
```

The database uses:

* Foreign keys
* `BEGIN IMMEDIATE` transactions + a process-wide write lock
* WAL journal mode
* Busy timeout
* Indexes on hot lookup paths
* Unique constraints (one product name, one bill-item per product per bill)
* Idempotency keys for finalize_bill

---

# Technology Stack

| Technology                 | Role                                  |
| --------------------------- | -------------------------------------- |
| Python 3.10+                 | Application language                    |
| Anthropic SDK                 | Agent orchestration (Claude tool use)   |
| Claude Sonnet 4.6               | LLM reasoning / tool selection          |
| python-telegram-bot               | Telegram integration                    |
| SQLite (`sqlite3` stdlib)           | Persistent data store                   |
| ReportLab                             | Invoice PDF generation                  |
| python-pptx                             | PowerPoint analysis deck generation     |
| python-dotenv / `.env`                    | Environment configuration               |

---

# Project Structure

```text
kirana-ops-agent/
│
├── agent.py            # system prompt, tool schema, control loop
├── tools.py            # inventory / billing / khata / preferences / daily close
├── documents.py        # PDF invoice + PPTX deck generation
├── bot.py              # Telegram wiring, dedup, session history
├── db.py                # connection + WriteTxn (BEGIN IMMEDIATE) helper
├── schema.sql            # table definitions
├── seed.py               # sample SKUs + default preferences
├── requirements.txt
├── .env.example
├── README.md
└── data/                 # kirana.db (SQLite, created on first run)
```

---

# Installation

## Requirements

* Python 3.10+
* Telegram account
* Telegram Bot Token (from @BotFather)
* Anthropic API key

## Clone

```bash
git clone <YOUR_PUBLIC_GITHUB_REPOSITORY_URL>
cd kirana-ops-agent
```

## Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Environment Configuration

Create a `.env` file:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

Never commit `.env` to GitHub. Only `.env.example` should be committed.

## Initialize Database

```bash
python seed.py
```

## Run

```bash
export $(cat .env | xargs)
python bot.py
```

## Tests (manual, business-logic layer)

```bash
python - <<'EOF'
import tools
b = tools.start_bill("test", customer_name=None)
tools.add_bill_item(b["bill_id"], "Loose Sugar", 2)
print(tools.get_bill_draft(b["bill_id"]))
EOF
```

---

# Telegram Usage

Start the bot:

```text
/start
```

Start a new conversation (preferences/stock/khata still remembered):

```text
/new
```

Inventory:

```text
what do we have?
what's running out?
how much maggi is left?
50 packets of maggi came in, cost 12, mrp 14
```

Billing:

```text
make a bill: 2kg sugar, 1 aashirvaad atta, 4 maggi
drop the sugar, make it 6 maggi
bill it, upi
```

Khata:

```text
put ₹500 on ramesh's credit
ramesh's balance?
ramesh paid ₹300
```

Analytics:

```text
close the day
today's sales?
make this week's sales analysis deck
```

Invoice:

```text
send that as a pdf
```

---

# End-to-End Billing Example

```text
Owner
 │
 │ "make a bill: 2kg sugar, 1 atta, 4 maggi"
 ▼
Claude → start_bill → add_bill_item ×3
 │
 ▼
Draft Bill
 │
 │ "drop the sugar, make it 6 maggi"
 ▼
Updated Draft
 │
 │ "bill it, upi"
 ▼
finalize_bill(idempotency_key=…)
 │
 ├── Re-validate stock (oversell guard)
 ├── Re-validate price ≥ cost
 ├── Compute GST (CGST/SGST)
 └── Decrement stock atomically
 │
 ▼
Bill Finalized
 │
 │ "send that as pdf"
 ▼
generate_invoice_pdf → Telegram document
```

---

# Requirement Coverage

| Capability                    | Status |
| -------------------------------| ------ |
| Telegram-only interface         | ✅ |
| AI agent (Claude tool use)        | ✅ |
| Agent tool orchestration            | ✅ |
| Natural-language interaction          | ✅ |
| Inventory management                    | ✅ |
| Stock query                                | ✅ |
| Receive stock                                | ✅ |
| Add product                                    | ✅ |
| Low-stock detection                              | ✅ |
| Conversational billing                             | ✅ |
| Draft bill                                           | ✅ |
| Bill editing                                           | ✅ |
| Bill finalization                                        | ✅ |
| Oversell protection                                        | ✅ |
| Atomic stock deduction                                       | ✅ |
| GST per item                                                   | ✅ |
| HSN code                                                         | ✅ |
| CGST + SGST                                                        | ✅ |
| Cash / UPI / Card / Credit                                            | ✅ |
| Khata / credit                                                          | ✅ |
| Daily close                                                               | ✅ |
| Sales analysis                                                              | ✅ |
| Invoice PDF                                                                   | ✅ |
| PPTX analysis deck                                                              | ✅ |
| Persistent preferences                                                            | ✅ |
| SQLite persistence                                                                  | ✅ |
| Telegram idempotency                                                                  | ✅ |
| Transaction safety                                                                      | ✅ |

---

# Demo

The recommended demo walks through the complete business workflow:

```text
1. /start
2. Receive stock (Maggi came in)
3. Show low-stock products
4. Create a multi-item bill
5. Edit the draft (drop/change an item)
6. Attempt to oversell → refused
7. Finalize the bill (UPI)
8. Send that bill as a PDF invoice
9. Put an amount on a customer's khata
10. Record a khata payment
11. Close the day
12. Generate the sales analysis deck
13. Set a preference → /new chat → confirm it's remembered
```

---

# Security

The public repository must not contain:

```text
.env
API keys
Telegram bot tokens
Passwords
Private credentials
Sensitive production database files
```

Use environment variables for secrets. Example configuration is provided through `.env.example` only.

---

# Future Enhancements

Possible extensions include:

* Sales-velocity based reorder suggestions
* Scheduled weekly analysis decks, auto-sent
* Batch and expiry tracking with FEFO
* Automated khata payment reminders
* Voice-note ordering (transcribe → bill)
* Tamil / Hindi multilingual interaction
* Barcode / product-photo → item identification
* Branded, templated invoice PDFs

---

# Project Links

**GitHub**
`<YOUR_PUBLIC_GITHUB_REPOSITORY_URL>`

**Telegram Bot**
`<YOUR_TELEGRAM_BOT_USERNAME>`

**Demo Video**
`<YOUR_DEMO_VIDEO_LINK>`

---

# Project Summary

Nebula Kirana is a practical demonstration of combining **AI agents with real backend engineering**.

The system does not stop at generating text responses. The agent interacts with deterministic tools that operate on persistent business data and perform real workflows such as inventory updates, billing, GST calculation, payment recording, customer credit management, daily closing, PDF generation, and PowerPoint reporting.

The architecture deliberately separates AI reasoning from business-critical operations:

```text
AI
↓
Orchestration
↓
Tools
↓
Business Rules
↓
Database
↓
Real Business Result
```

This makes the project a demonstration of:

**AI Engineering + Agentic Systems + Backend Engineering + Database Engineering + Financial Logic + Automation + API Integration.**

> **The model orchestrates. The tools enforce. The database persists.**
