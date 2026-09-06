

````md
# Nebula Kirana — AI-Powered Supermarket Operations Agent

> A Telegram-based AI agent for managing Indian kirana store operations through natural language.

Nebula Kirana is an AI-powered supermarket operations system that combines **agentic AI, backend engineering, database persistence, deterministic business logic, GST calculation, customer credit management, transaction safety, and document automation** into a single Telegram interface.

The core principle is:

> **The model orchestrates. The tools enforce. The database persists.**

---

## 🎥 Demo

### End-to-End Product Demo

[▶️ Watch the Full Demo Video](YOUR_DEMO_VIDEO_LINK)

> Complete demonstration of the Telegram-based AI Supermarket Operations Agent.

---

## 🚀 Key Features

### 🤖 AI Agent

- Natural-language interaction through Telegram
- Tool-based AI agent orchestration
- Multi-step tool calling
- Multi-turn conversational workflows
- Clarification handling for ambiguous requests
- No large regex / `if-else` intent router
- Database-grounded responses

### 📦 Inventory Management

- Product creation and lookup
- Stock receiving
- Stock queries
- Low-stock detection
- Reorder levels
- Cost price
- Selling price
- MRP
- GST rate
- HSN code
- Loose and packaged products
- Multiple units:
  - kg
  - g
  - litre
  - ml
  - packet
  - dozen
  - piece

### 🧾 Conversational Billing

- Create draft bills
- Add items
- Remove items
- Edit quantities
- Automatic bill recalculation
- GST calculation
- Cash / UPI / Card / Credit payments
- Payment references
- Stock validation
- Atomic stock deduction
- Idempotent bill finalization
- Invoice PDF generation

### 💰 GST & Financial Logic

- Item-level GST calculation
- CGST + SGST split
- HSN-based product configuration
- INR-safe calculations using paise
- Deterministic financial calculations
- GST handled by backend tools instead of the language model

### 👤 Khata / Customer Credit

- Customer credit ledger
- Credit entries
- Payment recording
- Outstanding balance
- Ledger history
- Overpayment protection
- Automatic credit posting from credit-mode bills

### 📊 Analytics

- Daily business close
- Sales analysis
- Payment-mode breakdown
- Top-selling products
- Stock insights
- Sales analysis deck generation

### 📄 Document Automation

- GST invoice PDF generation
- Sales analysis PowerPoint generation
- Generated documents delivered directly through Telegram

### 🧠 Persistent Memory

- Store preferences persisted in SQLite
- Preferences survive `/new`
- Business state is independent of conversation history

---

## 🏗️ Architecture

```text
                    STORE OWNER
                        │
                        ▼
                 Telegram / grammY
                        │
                        ▼
                ┌────────────────┐
                │    AI AGENT    │
                │  Vercel AI SDK │
                │  + OpenRouter  │
                └───────┬────────┘
                        │
                        ▼
                ┌────────────────┐
                │  DOMAIN TOOLS  │
                ├────────────────┤
                │ Inventory      │
                │ Billing        │
                │ Khata          │
                │ Analytics      │
                │ Memory         │
                └───────┬────────┘
                        │
                        ▼
                ┌────────────────┐
                │     SQLite     │
                │ better-sqlite3 │
                └───────┬────────┘
                        │
                 ┌──────┴───────┐
                 ▼              ▼
            Invoice PDF     Analysis PPTX
              PDFKit         PptxGenJS
                 │              │
                 └──────┬───────┘
                        ▼
                     Telegram
````

### Separation of Responsibilities

```text
AI Agent
   │
   ├── Understand request
   ├── Select tools
   └── Orchestrate workflow
            │
            ▼
      Domain Tools
            │
            ├── Validate inputs
            ├── Enforce business rules
            ├── Calculate GST
            └── Execute transactions
                    │
                    ▼
                 SQLite
                    │
                    └── Persistent business state
```

Critical business decisions are enforced by backend tools rather than relying entirely on model output.

---

## 🔐 Transaction Safety

Billing follows a controlled workflow:

```text
Create Draft
     │
     ▼
Add / Edit Items
     │
     ▼
Validate
     │
     ▼
Finalize
     │
     ▼
Re-check Stock
     │
     ▼
Calculate GST
     │
     ▼
Deduct Stock Atomically
     │
     ▼
Commit Transaction
     │
     ▼
Generate Invoice
```

### Draft Bill Safety

Stock is **not deducted when a draft bill is created**.

The store owner can freely:

* Add products
* Remove products
* Change quantities
* Review the bill

Stock is deducted only after successful finalization.

### Oversell Protection

Before finalization, the backend re-checks the actual inventory inside the transaction.

```text
Requested Quantity
        │
        ▼
Re-read Current Stock
        │
    ┌───┴────┐
    ▼        ▼
 Enough   Insufficient
    │        │
    ▼        ▼
 Continue   Reject
```

This prevents concurrent transactions from selling more stock than available.

### Idempotency

Telegram updates and bill finalization use idempotency protection to prevent duplicate processing and accidental double stock deduction.

---

## 💳 Payments

Supported payment modes:

```text
CASH
UPI
CARD
CREDIT
```

Payment references can be recorded for UPI/Card transactions.

Example:

```text
Finalize the current bill and pay by UPI
with reference UPI-DEMO-001
```

No real payment gateway is connected. Payment information is recorded as part of the store transaction.

---

## 🧮 GST Calculation

GST is calculated from the product configuration stored in the database.

```text
Product
   │
   ├── Selling Price
   ├── GST Rate
   └── HSN Code
          │
          ▼
      GST Engine
          │
     ┌────┴────┐
     ▼         ▼
   CGST       SGST
     │         │
     └────┬────┘
          ▼
      Total GST
          │
          ▼
       Bill Total
```

The model does not invent GST rates or totals.

Financial calculations are performed by deterministic backend logic.

---

## 🗃️ Database

SQLite is used as the persistent source of truth through `better-sqlite3`.

Main entities include:

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

Database features include:

* WAL mode
* Foreign keys
* Transaction-safe writes
* Busy timeout
* Indexed lookups
* Persistent application state
* Idempotency protection

---

## 📈 Sales & Analytics

Analytics are generated from persisted business data rather than model memory.

Supported workflows include:

```text
Show today's sales

Close today's business

Analyze today's sales

Generate sales analysis deck
```

The analytics layer can provide:

* Total sales
* Number of bills
* GST collected
* Payment-mode breakdown
* Product sales
* Stock insights

---

## 📄 Invoice PDF

The system generates real invoice PDFs using **PDFKit**.

Invoices contain:

* Shop name
* GSTIN
* Bill number
* Date
* Customer name
* Products
* Quantity
* Unit price
* HSN code
* GST rate
* CGST
* SGST
* Tax total
* Grand total
* Payment mode
* Payment reference

The generated invoice is delivered directly to the store owner through Telegram.

Example:

```text
Generate invoice PDF
```

---

## 📊 PowerPoint Analysis Deck

The system generates a PowerPoint sales analysis deck using **PptxGenJS**.

The deck can include:

* Sales summary
* Daily sales trends
* Top-selling products
* Payment-mode analysis
* Stock / reorder insights

Example:

```text
Generate sales analysis deck
```

The generated PPTX is delivered through Telegram.

---

## 👤 Khata Workflow

Example:

```text
User:
Put ₹500 on Ramesh's credit

Agent:
Credit of ₹500 recorded for Ramesh.

User:
Ramesh paid ₹200 by UPI

Agent:
₹200 payment recorded.
Remaining balance: ₹300
```

The complete ledger is persisted in SQLite.

---

## 🧠 Persistent Memory

Store preferences are persisted outside the conversation history.

Example:

```text
User:
Remember that my shop name is Nebula Kirana
```

Later:

```text
/new

User:
What is my shop name?
```

The preference remains available because it is stored in the database.

```text
Conversation
     │
     ▼
   Agent
     │
     ▼
Memory Tool
     │
     ▼
 SQLite
     │
     ▼
Persistent Preference
```

---

## 💬 Example Agent Interaction

```text
User:
Create a bill for 2 Maggi 70g and 1 Tata Salt 1kg

Agent:
Draft bill created.

Maggi 70g    2 × ₹14
Tata Salt    1 × ₹28

Subtotal: ₹56.00
CGST: ₹2.38
SGST: ₹2.38
Total: ₹60.76

Stock has not been deducted yet.
```

The user can then modify the draft:

```text
Change Maggi quantity to 3
```

or:

```text
Remove Tata Salt
```

Then finalize:

```text
Finalize the current bill and pay by UPI
with reference UPI-DEMO-001
```

The backend then:

```text
Validate Stock
      ↓
Calculate GST
      ↓
Finalize Bill
      ↓
Deduct Stock
      ↓
Record Payment
      ↓
Return Result
```

---

## 🧰 Technology Stack

| Technology         | Purpose                                 |
| ------------------ | --------------------------------------- |
| **TypeScript**     | Application development                 |
| **Node.js**        | Runtime                                 |
| **Vercel AI SDK**  | AI agent orchestration and tool calling |
| **OpenRouter**     | LLM gateway and model routing           |
| **grammY**         | Telegram Bot API integration            |
| **SQLite**         | Persistent database                     |
| **better-sqlite3** | SQLite database access                  |
| **Zod**            | Tool input validation                   |
| **PDFKit**         | Invoice PDF generation                  |
| **PptxGenJS**      | PowerPoint analysis generation          |
| **dotenv**         | Environment configuration               |

---

## 📁 Project Structure

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
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ Setup

### Requirements

* Node.js
* Telegram account
* Telegram Bot Token
* OpenRouter API Key

### Clone

```bash
git clone YOUR_PUBLIC_GITHUB_REPOSITORY_URL
cd nebula-supermarket-ops-agent
```

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Create a `.env` file:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/free

TELEGRAM_BOT_TOKEN=your_telegram_bot_token

SHOP_NAME=Nebula Kirana
SHOP_GSTIN=33AAAAA0000A1Z5

DB_PATH=./data/store.db
```

> Never commit `.env` or any API credentials to GitHub.

### Run

```bash
npm run dev
```

The Telegram bot will start and can be accessed through Telegram.

---

## 📱 Telegram Usage

### Start

```text
/start
```

### New Conversation

```text
/new
```

`/new` resets conversational history while persistent business data remains intact.

### Inventory

```text
show me all products

show low stock items

how much Maggi 70g is available?

receive 10 Maggi 70g into stock
```

### Billing

```text
Create a bill for 2 Maggi 70g and 1 Tata Salt 1kg

Change Maggi quantity to 3

Remove Tata Salt

Show me the current bill

Finalize the current bill and pay by UPI
with reference UPI-DEMO-001
```

### Khata

```text
Put ₹500 on Ramesh's credit

Show Ramesh's balance

Ramesh paid ₹200
```

### Analytics

```text
Close today's business

Show today's sales analysis

Generate sales analysis deck
```

### Invoice

```text
Generate invoice PDF
```

### Memory

```text
Remember that my shop name is Nebula Kirana

What is my shop name?
```

---

## 🧪 Requirement Coverage

| Capability                   | Status |
| ---------------------------- | ------ |
| Telegram-only interface      | ✅      |
| AI Agent                     | ✅      |
| Tool orchestration           | ✅      |
| Natural-language interaction | ✅      |
| Inventory management         | ✅      |
| Stock receiving              | ✅      |
| Stock query                  | ✅      |
| Product creation             | ✅      |
| Low-stock detection          | ✅      |
| Reorder levels               | ✅      |
| Conversational billing       | ✅      |
| Draft bill                   | ✅      |
| Bill editing                 | ✅      |
| Bill finalization            | ✅      |
| Oversell protection          | ✅      |
| Atomic stock deduction       | ✅      |
| GST calculation              | ✅      |
| HSN handling                 | ✅      |
| CGST + SGST                  | ✅      |
| Cash / UPI / Card            | ✅      |
| Khata / Credit               | ✅      |
| Daily close                  | ✅      |
| Sales analysis               | ✅      |
| Invoice PDF                  | ✅      |
| PPTX analysis deck           | ✅      |
| Persistent preferences       | ✅      |
| SQLite persistence           | ✅      |
| Telegram idempotency         | ✅      |
| Transaction safety           | ✅      |

---

## 🎬 Demo Flow

The recommended demonstration covers the complete store workflow:

```text
1. /start

2. Show inventory

3. Show low-stock products

4. Receive stock

5. Create a multi-item bill

6. Edit the draft bill

7. Show GST calculation

8. Finalize using UPI

9. Verify stock deduction

10. Generate invoice PDF

11. Add customer credit

12. Record Khata payment

13. Close the business day

14. Generate sales analysis

15. Generate PPTX analysis deck

16. Set a persistent preference

17. Use /new

18. Verify the preference is remembered
```

---

## 🔒 Security

The repository must never contain:

```text
.env
API keys
Telegram bot tokens
Passwords
Private credentials
Production database files
```

Use environment variables for all secrets.

Only `.env.example` should be committed.

---

## 🔮 Future Enhancements

* Sales-velocity based reorder suggestions
* Scheduled weekly analysis decks
* Batch and expiry tracking with FEFO
* Automated Khata payment reminders
* Voice-note ordering
* Tamil / Hindi multilingual interaction
* Barcode / product-photo recognition
* Branded invoice templates

---

## 🔗 Project Links

### GitHub

[📂 View Source Code](YOUR_PUBLIC_GITHUB_REPOSITORY_URL)

### Telegram Bot

[🤖 Open Nebula Kirana Bot](https://t.me/NebulaSupermarketOpsBot)

### Demo Video

[▶️ Watch the Full Demo](https://drive.google.com/file/d/1N0M1fr9OoNwWEb1IFUOx7Q23I6OvCLIp/view?usp=sharing)

---

## 💡 Project Summary

Nebula Kirana demonstrates how **AI agents can be combined with real backend engineering to automate business workflows**.

The system goes beyond generating text responses. The AI agent interacts with deterministic backend tools and a persistent database to execute real supermarket operations:

```text
Inventory
    ↓
Billing
    ↓
GST
    ↓
Payments
    ↓
Stock Updates
    ↓
Khata
    ↓
Analytics
    ↓
Invoice PDF
    ↓
PPTX Report
    ↓
Persistent Memory
```

The architecture deliberately separates AI reasoning from business-critical execution.

### Engineering Focus

**AI Engineering + Agentic Systems + Backend Engineering + Database Engineering + Financial Logic + Transaction Safety + Automation + API Integration**

> **The model orchestrates. The tools enforce. The database persists.**

```

**Important bro:** `YOUR_DEMO_VIDEO_LINK`, `YOUR_PUBLIC_GITHUB_REPOSITORY_URL`, `YOUR_TELEGRAM_BOT_USERNAME` mattum un actual values-la replace pannidu. बाकी README direct-ah use pannalaam.
```
