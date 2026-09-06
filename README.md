
# 🛒 Nebula Kirana — Supermarket Ops Agent

> AI-powered Telegram-based Supermarket Operations Agent for Indian Kirana Stores.

Nebula Kirana is a conversational AI agent designed to help Indian kirana store owners manage day-to-day supermarket operations directly through Telegram.

The system combines:

- AI agent orchestration
- Inventory management
- Conversational billing
- GST-aware invoicing
- Cash / UPI / Card payment recording
- Khata / credit ledger
- Daily business closing
- Sales analysis
- PDF invoice generation
- PowerPoint analysis deck generation
- Persistent preferences
- SQLite database persistence
- Idempotency and transaction safeguards

**The chat is the product.**

There is no separate admin dashboard or web UI required for normal store operations.

---

# 🎯 Project Objective

The goal of Nebula Kirana is to provide a simple conversational interface for supermarket operations.

Instead of navigating through multiple forms and dashboards, a store owner can simply send natural-language messages through Telegram.

Examples:

```text
show me all products
````

```text
How much Maggi is available?
```

```text
Create a bill for 2 Maggi and 1 Tata Salt
```

```text
Add 20 Tata Salt to stock
```

```text
Show Ramesh khata
```

```text
Close today's business
```

```text
Generate sales analysis deck
```

The AI agent interprets the request and selects the appropriate business tool.

---

# ✨ Key Features

## 🧠 AI Agent

* Natural-language supermarket assistant
* AI-driven tool selection
* Multi-step tool execution
* Conversational clarification
* Persistent preferences
* Agent-first architecture
* No large regex-based intent router

The model is responsible for understanding and orchestrating the request.

Deterministic business tools are responsible for enforcing business rules.

---

# 📦 Inventory Management

The inventory system supports:

* Product listing
* Stock queries
* Stock receiving
* New product creation
* Low-stock detection
* Reorder levels
* Cost price
* Selling price
* MRP
* GST rate
* HSN code
* Product units

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

The system supports both packaged and loose grocery products.

### Sample Products

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

---

# 🧾 Conversational Billing

Users can create bills naturally.

Example:

```text
Create a bill for 2 Maggi and 1 Tata Salt
```

The billing system maintains:

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
* Total

---

# 🔄 Draft → Edit → Finalize

Billing follows a controlled multi-stage workflow.

```text
CREATE BILL
     │
     ▼
   DRAFT
     │
     ├── Add item
     ├── Remove item
     └── Edit quantity
     │
     ▼
 UPDATED DRAFT
     │
     ▼
 FINALIZE
     │
     ▼
 STOCK DEDUCTION
     │
     ▼
 INVOICE
```

### Important

Stock is **not deducted when a draft is created**.

Stock is deducted only after successful finalization.

This prevents inventory corruption while the user is still editing the bill.

---

# 🛡️ Oversell Protection

The billing layer validates stock before finalization.

```text
Requested Quantity
        │
        ▼
Available Stock Check
        │
   ┌────┴────┐
   │         │
   ▼         ▼
Enough     Not Enough
Stock        Stock
   │           │
   ▼           ▼
Allow Sale   Reject Sale
```

The system does not allow the user to sell more quantity than is available.

This rule is enforced inside the business layer instead of relying only on the AI model.

---

# 🧮 GST & Tax Calculation

GST is calculated separately for each bill item.

Each product stores:

```text
GST Rate
HSN Code
```

The calculation flow is:

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
   ┌─┴─┐
   ▼   ▼
 CGST SGST
   │   │
   └─┬─┘
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

Financial calculations are internally represented using integer paise.

Example:

```text
₹100.00
   ↓
10000 paise
```

This reduces floating-point precision issues during financial calculations.

---

# 💳 Payment Management

Supported payment modes:

```text
Cash
UPI
Card
```

Payment references can also be stored.

Example:

```text
Finalize the bill and pay by UPI
Reference: UPI123456
```

No real payment gateway is connected.

Payments are recorded as business transactions only.

---

# 📒 Khata / Credit Ledger

Nebula Kirana supports customer credit management.

Capabilities:

* Customer lookup
* Credit entry
* Payment entry
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

Ledger entries are persisted in SQLite.

---

# 📊 Daily Close

The daily-close feature summarizes the day's business.

It can provide:

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

# 📈 Sales Analysis

The system provides sales analysis using persisted business data.

Examples:

```text
Show today's sales analysis
```

```text
Analyze this week's sales
```

The analysis tools read sales and inventory data from the database.

---

# 📄 GST Invoice PDF

Nebula Kirana generates real invoice PDF files.

The invoice can contain:

* Shop name
* GSTIN
* Bill number
* Date
* Customer name
* Product name
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

The generated PDF is sent directly through Telegram.

---

# 📊 Sales Analysis PPTX

The system can generate a PowerPoint analysis deck from store data.

Example:

```text
Generate sales analysis deck
```

The deck is generated using PptxGenJS and delivered to Telegram.

---

# 🧠 Persistent Memory

The agent supports persistent shop preferences.

Example:

```text
Remember that my shop name is Nebula Kirana
```

Preferences are stored in the database.

They can be reused across future conversations and sessions.

---

# 🏗️ SYSTEM ARCHITECTURE

Nebula Kirana follows an **AI-first, tool-driven architecture**.

The Telegram chat is the user interface.

The AI agent interprets natural-language requests and orchestrates domain-specific tools.

Critical business rules are enforced inside the tool/database layer.

---

## 🔷 High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         STORE OWNER                         │
│                                                             │
│               Natural Language Telegram Chat                │
│                                                             │
│  "Create a bill for 2 Maggi and 1 Tata Salt"               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     TELEGRAM LAYER                          │
│                          grammY                              │
│                                                             │
│  • Receive Telegram messages                                │
│  • Identify Telegram user                                  │
│  • Handle /start and /new                                  │
│  • Send responses                                           │
│  • Send PDF / PPTX files                                   │
│  • Handle Telegram errors                                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       AI AGENT                              │
│                                                             │
│                 Vercel AI SDK + Gemini                      │
│                                                             │
│  • Understand user request                                 │
│  • Select tools                                             │
│  • Execute multi-step operations                           │
│  • Ask clarification                                       │
│  • Generate final response                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Tool Calls
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN TOOL LAYER                       │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │ Inventory   │  │ Billing     │  │ Khata              │ │
│  │ Tools       │  │ Tools       │  │ Tools              │ │
│  │             │  │             │  │                    │ │
│  │ Stock       │  │ Create      │  │ Customer           │ │
│  │ Receive     │  │ Edit        │  │ Credit             │ │
│  │ Add Product │  │ Finalize    │  │ Payment            │ │
│  │ Low Stock   │  │ Invoice     │  │ Balance            │ │
│  └─────────────┘  └─────────────┘  └────────────────────┘ │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │ Analytics   │  │ Memory      │  │ Artifact           │ │
│  │ Tools       │  │ Tools       │  │ Generators         │ │
│  │             │  │             │  │                    │ │
│  │ Daily Close │  │ Preferences │  │ Invoice PDF        │ │
│  │ Sales       │  │ Persistent  │  │ Analysis PPTX      │ │
│  │ Analysis    │  │ Memory      │  │                    │ │
│  └─────────────┘  └─────────────┘  └────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                          │
│                                                             │
│                         SQLite                              │
│                    better-sqlite3                           │
│                                                             │
│  products                                                   │
│  bills                                                      │
│  bill_items                                                 │
│  stock_movements                                            │
│  customers                                                  │
│  khata_entries                                              │
│  preferences                                                │
│  telegram_updates                                           │
│  agent_sessions                                             │
│  idempotency_keys                                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ARTIFACT OUTPUT                          │
│                                                             │
│        ┌────────────────┐    ┌────────────────┐             │
│        │ Invoice PDF    │    │ Analysis PPTX  │             │
│        │ PDFKit         │    │ PptxGenJS      │             │
│        └────────────────┘    └────────────────┘             │
│                         │                                   │
│                         ▼                                   │
│                    Telegram User                            │
└─────────────────────────────────────────────────────────────┘
```

---

# 🧠 Agent-First Architecture

The system does not depend on a large regex or `if/else` router.

Instead:

```text
User Message
     │
     ▼
AI Agent
     │
     ├──────────► Inventory Tools
     │
     ├──────────► Billing Tools
     │
     ├──────────► Khata Tools
     │
     ├──────────► Analytics Tools
     │
     └──────────► Memory Tools
```

The agent decides which tools are required based on the user's request.

---

# 🔄 Request Lifecycle

```text
Telegram Message
       │
       ▼
Telegram Bot
       │
       ▼
Owner Identification
       │
       ▼
AI Agent
       │
       ▼
Request Understanding
       │
       ▼
Tool Selection
       │
       ▼
Business Tool
       │
       ▼
Database Operation
       │
       ▼
Validated Result
       │
       ▼
AI Agent Response
       │
       ▼
Telegram
```

For generated artifacts:

```text
User Request
     │
     ▼
AI Agent
     │
     ▼
Business Tool
     │
     ▼
Artifact Generator
     │
     ├──────► PDF
     │
     └──────► PPTX
             │
             ▼
          Telegram
```

---

# 🧾 Billing Architecture

```text
                  CREATE BILL
                       │
                       ▼
                  ┌─────────┐
                  │  DRAFT  │
                  └────┬────┘
                       │
              Add / Edit / Remove
                       │
                       ▼
                UPDATED DRAFT
                       │
                       ▼
                    CONFIRM
                       │
                       ▼
                 VALIDATION
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       Stock         GST         Payment
       Check        Check         Check
          │            │            │
          └────────────┼────────────┘
                       │
                       ▼
                   FINALIZE
                       │
                       ▼
              ATOMIC STOCK UPDATE
                       │
                       ▼
                INVOICE PDF
                       │
                       ▼
                   TELEGRAM
```

---

# 📦 Inventory Architecture

```text
                    INVENTORY
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
     Stock Query   Receive Stock   Add Product
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
                     SQLite
                        │
                        ▼
                 Stock Movements
```

Product data includes:

```text
Product
 ├── Name
 ├── Unit
 ├── Cost Price
 ├── Selling Price
 ├── MRP
 ├── Quantity
 ├── Reorder Level
 ├── GST Rate
 ├── HSN Code
 └── Active Status
```

---

# 🛡️ Transaction & Safety Architecture

Critical operations are handled by deterministic business tools.

The AI model does not directly manipulate the database.

```text
AI Agent
    │
    ▼
Business Tool
    │
    ├── Validate Input
    ├── Validate Business Rules
    ├── Check Stock
    ├── Calculate GST
    └── Execute Transaction
             │
             ▼
          SQLite
```

---

# 🔐 Atomic Billing Transaction

During finalization:

```text
BEGIN TRANSACTION
       │
       ├── Validate Bill
       │
       ├── Validate Stock
       │
       ├── Calculate GST
       │
       ├── Record Payment
       │
       ├── Deduct Stock
       │
       ├── Record Stock Movement
       │
       └── Mark Bill Finalized
                │
                ▼
          COMMIT TRANSACTION
```

If a critical operation fails before commit, the transaction can be rolled back.

---

# 🔁 Telegram Idempotency

Telegram updates are tracked to reduce duplicate processing.

```text
Telegram Update
       │
       ▼
Check update_id
       │
    ┌──┴──┐
    │     │
Already  New
Processed Update
    │     │
    ▼     ▼
 Ignore Process
          │
          ▼
     Store update_id
```

Business operations also use idempotency keys where required.

---

# 🗃️ Database Architecture

The SQLite database contains:

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

Relationships:

```text
products
    │
    ├──────────► bill_items
    │                 │
    │                 ▼
    │               bills
    │
    └──────────► stock_movements


customers
    │
    └──────────► khata_entries
```

Database features include:

* Foreign keys
* Transactions
* WAL mode
* Busy timeout
* Indexes
* Unique constraints
* Idempotency keys

---

# 📊 Analytics Architecture

```text
                 SQLite
                    │
          ┌─────────┼─────────┐
          │         │         │
          ▼         ▼         ▼
        Bills      Items     Stock
          │         │         │
          └─────────┼─────────┘
                    │
                    ▼
                Analytics
                    │
             ┌──────┴──────┐
             │             │
             ▼             ▼
        Daily Close   Sales Analysis
             │             │
             └──────┬──────┘
                    ▼
             Business Insights
```

---

# 📄 Artifact Architecture

## Invoice PDF

```text
Billing Data
     │
     ▼
Invoice Generator
     │
     ▼
PDFKit
     │
     ▼
GST Invoice PDF
     │
     ▼
Telegram
```

## Analysis PPTX

```text
Sales Data
     │
     ▼
Analytics Tool
     │
     ▼
Deck Generator
     │
     ▼
PptxGenJS
     │
     ▼
PowerPoint File
     │
     ▼
Telegram
```

---

# 🧠 Memory Architecture

```text
User
 │
 │ "Remember my shop name"
 ▼
AI Agent
 │
 ▼
Memory Tool
 │
 ▼
preferences table
 │
 ▼
Future Conversation
 │
 ▼
Preference Retrieved
```

Preferences survive across conversations because they are persisted in SQLite.

---

# 🔒 Separation of Responsibilities

The architecture separates AI reasoning from deterministic business logic.

```text
┌────────────────────────────────────┐
│              AI AGENT              │
│                                    │
│ • Understand request                │
│ • Select tool                      │
│ • Ask clarification                │
│ • Explain result                   │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│          BUSINESS TOOLS            │
│                                    │
│ • Validate inputs                  │
│ • Apply business rules             │
│ • Calculate GST                    │
│ • Validate stock                   │
│ • Execute transactions             │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│             DATABASE               │
│                                    │
│ • Persistent state                 │
│ • Transactions                     │
│ • Constraints                      │
│ • Idempotency                      │
└────────────────────────────────────┘
```

### Core principle

> **The model orchestrates; deterministic tools enforce.**

---

# 🧰 Technology Stack

| Technology     | Purpose                   |
| -------------- | ------------------------- |
| TypeScript     | Application development   |
| Node.js        | Runtime                   |
| Telegram       | User interface            |
| grammY         | Telegram bot framework    |
| Vercel AI SDK  | Agent orchestration       |
| Google Gemini  | AI model                  |
| Zod            | Input validation          |
| SQLite         | Persistent database       |
| better-sqlite3 | SQLite integration        |
| PDFKit         | Invoice PDF generation    |
| PptxGenJS      | PowerPoint generation     |
| dotenv         | Environment configuration |

---

# 📁 Project Structure

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
└── tsconfig.json
```

---

# 📱 Telegram Instructions

The entire supermarket system can be controlled through Telegram.

Start:

```text
/start
```

Start a new bill:

```text
/new
```

However, users can also use natural language.

### Inventory

```text
show me all products
```

```text
show low stock items
```

```text
How much Maggi is available?
```

### Billing

```text
Create a bill for 2 Maggi and 1 Tata Salt
```

```text
Remove Tata Salt
```

```text
Change Maggi quantity to 3
```

```text
Finalize the bill and pay by UPI
```

### Stock

```text
Add 20 Tata Salt to stock
```

### Khata

```text
Show Ramesh khata
```

```text
Ramesh paid ₹500 by UPI
```

### Daily Close

```text
Close today's business
```

### Analytics

```text
Generate sales analysis deck
```

### Invoice

```text
Generate invoice PDF
```

---

# ⚙️ Installation & Setup

## Requirements

Install:

* Node.js
* npm
* Telegram account
* Telegram Bot Token
* Google Gemini API key

---

## 1. Clone Repository

```bash
git clone <YOUR_PUBLIC_GITHUB_REPOSITORY_URL>
cd nebula-supermarket-ops-agent
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Environment Variables

Create:

```text
.env
```

Example:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash

SHOP_NAME=Nebula Kirana
SHOP_GSTIN=33AAAAA0000A1Z5

DB_PATH=./data/store.db
```

### ⚠️ Security

Never commit:

```text
.env
```

to GitHub.

Never expose:

* Telegram bot token
* Gemini API key
* Other credentials

Only commit:

```text
.env.example
```

---

# 🗄️ Database Initialization

Seed the supermarket database:

```bash
npx tsx src/db/seed.ts
```

This creates sample kirana inventory.

---

# ▶️ Run the Bot

```bash
npm run dev
```

The bot will start listening for Telegram messages.

---

# 🧪 Testing

TypeScript validation:

```bash
npx tsc --noEmit
```

Run automated tests:

```bash
npm test
```

---

# 🔄 Complete Example Workflow

```text
User
 │
 │ Create a bill
 ▼
AI Agent
 │
 ▼
Billing Tool
 │
 ▼
Draft Bill
 │
 │ Edit
 ▼
Updated Draft
 │
 │ Confirm
 ▼
Finalize
 │
 ├── Stock Check
 ├── GST Calculation
 ├── Payment
 ├── Atomic Stock Deduction
 └── Stock Movement
 │
 ▼
Invoice PDF
 │
 ▼
Telegram
```

---

# 🎬 Demo Flow

The recommended demonstration covers:

```text
1. /start

2. Show all products

3. Show low-stock items

4. Create a bill

5. Edit the bill

6. Finalize the bill

7. Record payment

8. Verify stock

9. Generate invoice PDF

10. Check Khata

11. Daily close

12. Sales analysis

13. Generate PPTX analysis deck
```

---

# 📋 Requirement Coverage

| Requirement              | Status |
| ------------------------ | ------ |
| Telegram-only interface  | ✅      |
| AI agent                 | ✅      |
| Agent tool orchestration | ✅      |
| Inventory management     | ✅      |
| Stock query              | ✅      |
| Low-stock detection      | ✅      |
| Receive stock            | ✅      |
| Add product              | ✅      |
| Conversational billing   | ✅      |
| Draft bill               | ✅      |
| Bill editing             | ✅      |
| Bill finalization        | ✅      |
| Atomic stock deduction   | ✅      |
| Oversell protection      | ✅      |
| GST per item             | ✅      |
| HSN code                 | ✅      |
| CGST + SGST              | ✅      |
| Cash / UPI / Card        | ✅      |
| Khata / credit           | ✅      |
| Daily close              | ✅      |
| Sales analysis           | ✅      |
| Invoice PDF              | ✅      |
| PPTX analysis deck       | ✅      |
| Persistent preferences   | ✅      |
| SQLite persistence       | ✅      |
| Telegram idempotency     | ✅      |
| Transaction protection   | ✅      |
| README documentation     | ✅      |
| Demo recording           | 🎥     |
| Public GitHub repository | 🔗     |

---

# 🛡️ Important Business Rules

The system follows these rules:

### Stock

Stock cannot become negative.

### Billing

Draft bills do not reduce inventory.

### Finalization

Inventory is updated only after successful bill finalization.

### GST

GST is calculated using the product's configured GST rate.

### Payments

Only Cash, UPI and Card are supported.

### Ambiguity

The agent asks for clarification when required information is unclear.

### Database

Critical operations are performed through validated business tools and database transactions.

---

# 🎯 Design Philosophy

Nebula Kirana follows three core principles.

## 1. Chat is the Product

The user should be able to perform supermarket operations directly through conversation.

## 2. AI Orchestrates

The AI understands the user's intent and chooses the appropriate tools.

## 3. Tools Enforce

Business-critical rules are implemented deterministically inside tools and the database.

This prevents important operations such as stock deduction and financial calculations from depending entirely on model reasoning.

---

# 🚀 Future Enhancements

Possible future improvements include:

* Weekly scheduled sales decks
* Reorder suggestions using sales velocity
* Batch and expiry tracking
* FEFO inventory handling
* Khata payment reminders
* Voice-note orders
* Tamil / Hindi multilingual support
* Barcode scanning
* Product photo recognition
* Advanced forecasting

---

# 🔗 Project Links

## Telegram Bot

```text
<YOUR_TELEGRAM_BOT_USERNAME>
```

## GitHub

```text
<YOUR_PUBLIC_GITHUB_REPOSITORY_URL>
```

## Demo Recording

```text
<YOUR_DEMO_VIDEO_LINK>
```

---

# 👨‍💻 Project Information

**Project:** Nebula Kirana — Supermarket Ops Agent

**Interface:** Telegram

**AI:** Google Gemini

**Agent Framework:** Vercel AI SDK

**Database:** SQLite

**Language:** TypeScript / Node.js

**Artifacts:** PDF + PPTX

---

# 🔐 Submission Security

Before making the repository public, verify that the repository does NOT contain:

```text
.env
API keys
Telegram bot tokens
Passwords
Private credentials
Database files containing sensitive information
```

Use:

```text
.env.example
```

for configuration documentation.

---

# 📌 Final Note

Nebula Kirana demonstrates an AI-first approach to supermarket operations where a store owner can manage inventory, billing, payments, customer credit, daily closing, analytics and business documents through a single conversational Telegram interface.

> **The model orchestrates. The tools enforce. The database persists.**

```

**Idhu dhaan one-file final README.** Existing `README.md`-a full replace pannidu. Assignment requirements-la irukkura capabilities + architecture + deliverables ellame cover pannirukku. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

**Next:** README save pannitu, `.env` GitHub-ku pogama irukkaa check pannitu **public GitHub upload** pannuvom.
```
