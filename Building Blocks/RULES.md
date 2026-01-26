# Building Block Rules & Architecture

This directory follows a strict **Chronological `a-b-c-d` Architecture** for Tally integration modules. Each integration task (e.g., fetching stats, fetching vouchers) is a self-contained "Building Block" composed of exactly 4 files.

## Naming Convention
`[SequenceNumber].[Part]-[DescriptiveName]-[Suffix].[Extension]`

Example: `1.a-companyName-fromDate-toDate-voucherQty-runner.bat`

---

## The A-B-C-D Flow

### 1. `*.a` - The Runner (Orchestrator)
- **Extension**: `.bat`
- **Suffix**: `-runner`
- **Purpose**: The entry point.
    - **Payload Generation**: Dynamically creates the XML payload file (e.g., `temp_1.xml`).
    - **Execution**: Runs the `curl` command to send the payload to Tally (localhost:9000).
    - **Pipelines**: Saves the raw response to the `b` file.
    - **Trigger**: Calls the `c` processor script upon success.
    - **Cleanup**: Deletes its own temporary XML payload file.

### 2. `*.b` - The Raw Input (Intermediate)
- **Extension**: `.xml`
- **Suffix**: `-xml-output`
- **Purpose**: The raw, untouched response from Tally.
    - serves as the **Input** for the Processor.
    - Kept for debugging and verification purposes.

### 3. `*.c` - The Processor (Logic)
- **Extension**: `.js`
- **Suffix**: `-processor`
- **Purpose**: The brain of the operation.
    - **Read**: Reads the `b` (XML) file.
    - **Parse**: Uses `xml2js` to convert XML to JSON.
    - **Logic**: validatess data, extracts specific fields, and applies business logic.
    - **Verify**: (Optional) For secondary blocks, verifies counts against previous blocks.
    - **Write**: Saves the final result to the `d` file.

### 4. `*.d` - The Output (Final Artifact)
- **Extension**: `.json`
- **Suffix**: `-json-output`
- **Purpose**: The final, clean data ready for the application.
    - This is the **only** file that the main application (React/Node) should consume.

---

## Execution Rules
1. **Sequential Execution**: Block 1 must run successfully before Block 2 if there are dependencies (e.g., verification).
2. **Relative Paths**: All scripts must use relative paths (e.g., `__dirname`) to ensure portability.
3. **Strict Cleanup**: The folder should **only** contain these 4 files per block (plus this RULES file). All temporary files (logs, temp XMLs) must be deleted by the Runner.

---

## Tally API Reference

**CRITICAL RULE**: For **ALL** Tally-related questions, integration syntax, API rules, TDL queries, XML structures, field names, or any Tally-specific implementation details:

### ⚠️ DO NOT GUESS OR ASSUME
**ALWAYS** consult the **NotebookLM Tally Notebook** first.

This includes:
- TDL Collection syntax
- XML request/response structures
- Field names and their exact casing
- Tally function names (e.g., `##SVCurrentCompany`)
- Voucher types and their properties
- Ledger/Stock/Group hierarchies
- Date formats and filters
- Any Tally-specific behavior

**How to Query NotebookLM**:
1. Use the `mcp_notebooklm_notebook_query` tool
2. Reference the Tally notebook ID
3. Ask specific, targeted questions
4. Verify the response before implementing

**Why This Matters**:
- Tally has specific, non-standard XML structures
- Field names are case-sensitive and version-dependent
- TDL syntax is unique and must be exact
- Guessing leads to silent failures and incorrect data
