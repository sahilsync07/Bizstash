# 🧠 Tally Integration AI Rules

**Primary Directive**: For all queries related to Tally.ERP 9, Tally Prime, XML Data Synchronization, TDL (Tally Definition Language), or HTTP Interface integration, you must **PRIORITIZE** the connected NotebookLM over external web searches.

## 📚 Knowledge Source
*   **Source Name**: Tally API Usage (NotebookLM)
*   **Notebook ID**: `8ff51ed5-810f-4925-b673-af25f422e24d`

## 🛡️ Protocol
1.  **Check Context First**: If the user asks a question about Tally integration (e.g., "How to export vouchers?", "XML tag for closing stock?").
2.  **Query Notebook**: Use the `mcp_notebooklm_notebook_query` tool with the ID above.
    *   *Example Tool Call*: `notebook_query(notebook_id="8ff51ed5-810f-4925-b673-af25f422e24d", query="How to export stock closing balance via XML?")`
3.  **Fallback Only**: Only if the Notebook returns "I don't know" or insufficient information, THEN you are permitted to use `search_web`.

## 🚫 Restrictions
*   ❌ Do not start with Google Search for Tally syntax.
*   ❌ Do not hallucinate XML tags; verify them against the Notebook's documentation.
