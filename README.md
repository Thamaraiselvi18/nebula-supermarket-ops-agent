Aama bro. **Company reviewer open pannumbodhu first 30 seconds-la project oda technical depth puriyanum** nu வைத்து README-ah position pannuvom.

Nee current `README.md`-a **full replace** panni, idha direct-ah paste pannidu:

````md
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
 AI Agent
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
````

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

The application uses an AI agent to understand natural-language requests and select the appropriate tools.

Example:

```text
"Create a bill for 2 Maggi and 1 Tata Salt"
```

The agent can determine that it needs to:

1. Identify the requested products
2. Create a draft bill
3. Add the requested quantities
4. Calculate the bill
5. Wait for further edits or confirmation
6. Finalize the transaction
7. Update inventory
8. Generate an invoice

The application does not rely on a large regex or `if/else` intent router.

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

Sample inventory:

```text
Aashirvaad Atta 5kg
Tata Salt 1kg
Amul Butter 100g
Fortune Sunflower Oil 1L
Maggi 70g
Parle-G
Surf Excel
Loose Sugar
Loose Rice
Loose Dal
```

Example commands:

```text
show me all products
```

```text
show low stock items
```

```text
How much Maggi is available?
```

```text
Add 20 Tata Salt to stock
```

---

# Conversational Billing

Billing is implemented as a controlled multi-step workflow rather than a single database insert.

```text
CREATE
  │
  ▼
DRAFT
  │
  ├── Add Item
  ├── Remove Item
  └── Edit Quantity
  │
  ▼
UPDATED DRAFT
  │
  ▼
VALIDATE
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
Create a bill for 2 Maggi and 1 Tata Salt
```

The bill maintains:

* Product
* Quantity
* Unit
* Unit price
* Cost price
* GST rate
* HSN code
* Taxable amount
* CGST
* SGST
* Tax
* Total

---

# Draft Bill Safety

Stock is **not deducted when a draft bill is created**.

Stock is deducted only after successful finalization.

This allows users to modify the bill without corrupting inventory.

Example:

```text
Create a bill for 2 Maggi and 1 Tata Salt
```

Then:

```text
Change Maggi quantity to 3
```

Then:

```text
Remove Tata Salt
```

Only after finalization does the inventory transaction take place.

---

# Oversell Protection

The billing layer validates stock before finalization.

```text
Requested Quantity
        │
        ▼
Available Stock
        │
    ┌───┴────┐
    │        │
 Enough   Insufficient
    │        │
    ▼        ▼
 Continue   Reject
```

The AI model cannot simply decide that a sale is valid.

The business tool checks the actual database state before committing the transaction.

This keeps inventory rules deterministic.

---

# Transaction-Safe Finalization

Critical billing operations are executed using database transactions.

```text
BEGIN TRANSACTION
       │
       ├── Validate Bill
       ├── Validate Stock
       ├── Calculate GST
       ├── Record Payment
       ├── Deduct Stock
       ├── Record Stock Movement
       └── Mark Bill Finalized
                │
                ▼
             COMMIT
```

If a critical operation fails before the transaction is committed, the database can roll back the operation instead of leaving partially updated business data.

---

# GST & Financial Calculations

GST is calculated per bill item using the product's configured GST rate and HSN code.

```text
Product Price
     │
     ▼
Quantity
     │
     ▼
Taxable Amount
     │
     ▼
GST Calculation
     │
 ┌───┴───┐
 ▼       ▼
CGST    SGST
 │       │
 └───┬───┘
     ▼
 Total GST
     │
     ▼
Final Amount
```

For intra-state transactions:

```text
GST = CGST + SGST
```

Financial values are represented internally using integer paise.

```text
₹100.00
   ↓
10000 paise
```

This avoids common floating-point precision problems in monetary calculations.

---

# Payments

Supported payment modes:

```text
Cash
UPI
Card
```

Payment references can also be recorded.

Example:

```text
Finalize the bill and pay by UPI
Reference: UPI123456
```

No real payment gateway is connected. Payment information is recorded as part of the store transaction.

---

# Khata / Customer Credit

The system includes a customer credit ledger.

It supports:

* Customer lookup
* Customer creation
* Credit entries
* Payment entries
* Outstanding balance
* Customer ledger

Examples:

```text
Show Ramesh khata
```

```text
Add ₹500 credit for Ramesh
```

```text
Ramesh paid ₹300 by UPI
```

All ledger entries are persisted in SQLite.

---

# Daily Close

The daily-close workflow summarizes store activity.

It can include:

* Total bills
* Total sales
* GST collected
* Cash sales
* UPI sales
* Card sales
* Credit sales
* Top-selling products
* Low-stock products

Example:

```text
Close today's business
```

---

# Sales Analysis

Sales analysis is generated from persisted business data.

Example:

```text
Show today's sales analysis
```

```text
Analyze this week's sales
```

The analytics layer reads actual bills, bill items, and inventory information from the database rather than relying on the AI model to invent business numbers.

---

# Invoice PDF Automation

The application generates real invoice PDFs using PDFKit.

Generated invoices can include:

* Shop name
* GSTIN
* Bill number
* Date
* Customer
* Product
* Quantity
* Unit
* Unit price
* HSN code
* GST rate
* Taxable value
* CGST
* SGST
* Total tax
* Grand total
* Payment mode
* Payment reference

Example:

```text
Generate invoice PDF
```

The generated PDF is sent back to the user through Telegram.

---

# PowerPoint Analysis Automation

The application can generate a PowerPoint sales analysis deck using PptxGenJS.

Example:

```text
Generate sales analysis deck
```

The deck is generated from store data and delivered directly through Telegram.

This demonstrates automated business reporting rather than only text-based AI responses.

---

# Persistent Memory

The system stores shop preferences in the database.

Example:

```text
Remember that my shop name is Nebula Kirana
```

The preference is persisted and can be reused later.

```text
User
 │
 ▼
AI Agent
 │
 ▼
Memory Tool
 │
 ▼
SQLite
 │
 ▼
Future Conversation
```

---

# Telegram Idempotency

Telegram updates are tracked to prevent duplicate processing.

```text
Telegram Update
      │
      ▼
Check update_id
      │
 ┌────┴────┐
 ▼         ▼
Existing   New
 │         │
 ▼         ▼
Ignore    Process
            │
            ▼
       Store update_id
```

Business operations can also use idempotency keys where required.

---

# Architecture

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         STORE OWNER                         │
│                                                             │
│                 Natural Language Telegram                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     TELEGRAM / grammY                       │
│                                                             │
│  Receive messages • Identify user • Send responses/files    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         AI AGENT                            │
│                                                             │
│                 Vercel AI SDK + Gemini                      │
│                                                             │
│  Understand → Decide → Tool Call → Observe → Respond       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       DOMAIN TOOLS                          │
│                                                             │
│ Inventory │ Billing │ Khata │ Analytics │ Memory            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLITE DATABASE                         │
│                                                             │
│ products • bills • bill_items • stock_movements             │
│ customers • khata_entries • preferences                     │
│ telegram_updates • agent_sessions • idempotency_keys        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
           ┌──────────────┐          ┌──────────────┐
           │  PDFKit      │          │ PptxGenJS    │
           │ Invoice PDF  │          │ Analysis     │
           └──────┬───────┘          └──────┬───────┘
                  │                         │
                  └────────────┬────────────┘
                               ▼
                           Telegram
```

---

# Agent Control Flow

```text
User Request
     │
     ▼
AI Agent
     │
     ▼
Tool Selection
     │
     ▼
Tool Execution
     │
     ▼
Database / External Operation
     │
     ▼
Tool Result
     │
     ▼
AI Agent
     │
     ▼
User Response
```

The model handles reasoning and orchestration.

The tool layer handles deterministic business logic.

The database is the source of truth for persistent business state.

---

# Separation of Responsibilities

```text
┌──────────────────────────────┐
│          AI AGENT            │
│                              │
│ Understand request           │
│ Select tools                 │
│ Orchestrate workflow         │
│ Ask clarification            │
│ Explain results              │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       BUSINESS TOOLS         │
│                              │
│ Validate inputs              │
│ Enforce business rules       │
│ Validate stock               │
│ Calculate GST                │
│ Execute transactions         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          DATABASE            │
│                              │
│ Persistent state             │
│ Transactions                 │
│ Constraints                  │
│ Idempotency                  │
└──────────────────────────────┘
```

This prevents critical business decisions from depending entirely on language-model output.

---

# Database Design

The project uses SQLite through `better-sqlite3`.

Main tables:

```text
products
bills
bill_items
stock_movements
customers
khata_entries
preferences
telegram_updates
agent_sessions
idempotency_keys
```

Core relationships:

```text
products
   │
   ├──────────► bill_items ──────────► bills
   │
   └──────────► stock_movements

customers
   │
   └──────────► khata_entries
```

The database uses:

* Foreign keys
* Transactions
* WAL mode
* Busy timeout
* Indexes
* Unique constraints
* Idempotency keys

---

# Technology Stack

| Technology     | Role                      |
| -------------- | ------------------------- |
| TypeScript     | Application language      |
| Node.js        | Runtime                   |
| Telegram       | Product interface         |
| grammY         | Telegram integration      |
| Vercel AI SDK  | Agent orchestration       |
| Google Gemini  | LLM                       |
| Zod            | Tool input validation     |
| SQLite         | Persistent data store     |
| better-sqlite3 | Database driver           |
| PDFKit         | Invoice generation        |
| PptxGenJS      | PowerPoint generation     |
| dotenv         | Environment configuration |

---

# Project Structure

```text
nebula-supermarket-ops-agent/
│
├── src/
│   ├── agent/
│   │   ├── index.ts
│   │   └── system.ts
│   │
│   ├── artifacts/
│   │   ├── invoice.ts
│   │   └── deck.ts
│   │
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── seed.ts
│   │
│   ├── telegram/
│   │   └── bot.ts
│   │
│   ├── tools/
│   │   ├── inventory.ts
│   │   ├── billing.ts
│   │   ├── khata.ts
│   │   ├── analytics.ts
│   │   └── memory.ts
│   │
│   └── index.ts
│
├── tests/
├── data/
├── .env.example
├── ARCHITECTURE.md
├── README.md
├── package.json
├── package-lock.json
└── tsconfig.json
```

---

# Installation

## Requirements

* Node.js
* npm
* Telegram account
* Telegram Bot Token
* Google Gemini API key

## Clone

```bash
git clone <YOUR_PUBLIC_GITHUB_REPOSITORY_URL>
cd nebula-supermarket-ops-agent
```

## Install Dependencies

```bash
npm install
```

## Environment Configuration

Create a `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash

SHOP_NAME=Nebula Kirana
SHOP_GSTIN=33AAAAA0000A1Z5

DB_PATH=./data/store.db
```

Never commit `.env` to GitHub.

Only `.env.example` should be committed.

## Initialize Database

```bash
npx tsx src/db/seed.ts
```

## Run

```bash
npm run dev
```

## TypeScript Check

```bash
npx tsc --noEmit
```

## Tests

```bash
npm test
```

---

# Telegram Usage

Start the bot:

```text
/start
```

Create a new billing session:

```text
/new
```

Inventory:

```text
show me all products
```

```text
show low stock items
```

```text
How much Maggi is available?
```

```text
Add 20 Tata Salt to stock
```

Billing:

```text
Create a bill for 2 Maggi and 1 Tata Salt
```

```text
Change Maggi quantity to 3
```

```text
Remove Tata Salt
```

```text
Finalize the bill and pay by UPI
```

Khata:

```text
Show Ramesh khata
```

```text
Add ₹500 credit for Ramesh
```

```text
Ramesh paid ₹300 by UPI
```

Analytics:

```text
Close today's business
```

```text
Show today's sales analysis
```

```text
Generate sales analysis deck
```

Invoice:

```text
Generate invoice PDF
```

---

# End-to-End Billing Example

```text
User
 │
 │ "Create a bill for 2 Maggi and 1 Tata Salt"
 ▼
AI Agent
 │
 ▼
Billing Tool
 │
 ▼
Draft Bill
 │
 │ "Change Maggi quantity to 3"
 ▼
Updated Draft
 │
 │ "Finalize and pay by UPI"
 ▼
Validation
 │
 ├── Product Validation
 ├── Stock Validation
 ├── GST Calculation
 └── Payment Validation
 │
 ▼
Database Transaction
 │
 ├── Deduct Stock
 ├── Record Stock Movement
 ├── Record Payment
 └── Finalize Bill
 │
 ▼
Invoice PDF
 │
 ▼
Telegram
```

---

# Requirement Coverage

| Capability                   | Status |
| ---------------------------- | ------ |
| Telegram-only interface      | ✅      |
| AI agent                     | ✅      |
| Agent tool orchestration     | ✅      |
| Natural-language interaction | ✅      |
| Inventory management         | ✅      |
| Stock query                  | ✅      |
| Receive stock                | ✅      |
| Add product                  | ✅      |
| Low-stock detection          | ✅      |
| Conversational billing       | ✅      |
| Draft bill                   | ✅      |
| Bill editing                 | ✅      |
| Bill finalization            | ✅      |
| Oversell protection          | ✅      |
| Atomic stock deduction       | ✅      |
| GST per item                 | ✅      |
| HSN code                     | ✅      |
| CGST + SGST                  | ✅      |
| Cash / UPI / Card            | ✅      |
| Khata / credit               | ✅      |
| Daily close                  | ✅      |
| Sales analysis               | ✅      |
| Invoice PDF                  | ✅      |
| PPTX analysis deck           | ✅      |
| Persistent preferences       | ✅      |
| SQLite persistence           | ✅      |
| Telegram idempotency         | ✅      |
| Transaction safety           | ✅      |

---

# Demo

The recommended demo demonstrates the complete business workflow:

```text
1. /start
2. Show inventory
3. Check low-stock products
4. Create a bill
5. Edit the draft
6. Finalize the bill
7. Record payment
8. Verify stock
9. Generate invoice PDF
10. Check Khata
11. Run daily close
12. Generate sales analysis
13. Generate PPTX analysis deck
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

Use environment variables for secrets.

Example configuration should be provided through:

```text
.env.example
```

---

# Future Enhancements

Possible extensions include:

* Sales-velocity based reorder suggestions
* Scheduled weekly analysis decks
* Batch and expiry tracking
* FEFO inventory management
* Automated Khata reminders
* Voice-note ordering
* Tamil / Hindi multilingual interaction
* Barcode scanning
* Product image recognition
* Demand forecasting

---

# Project Links

**GitHub**

<YOUR_PUBLIC_GITHUB_REPOSITORY_URL>

**Telegram Bot**

<YOUR_TELEGRAM_BOT_USERNAME>

**Demo Video**

<YOUR_DEMO_VIDEO_LINK>

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

```

**Idhu dhaan bro namma final professional README.** Un uploaded README-la irukkura actual project capabilities/architecture-ai base pannithaan structure pannirukken. :contentReference[oaicite:0]{index=0}

Idha paste pannina reviewer-ku **“chatbot project”** nu illa — **AI Agent + Backend + DB + business logic + automation project** nu first impression varum.
```
