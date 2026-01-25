# Bizstash - Accountant PC Setup Instructions

## Prerequisites
1.  **Node.js**: Install Node.js (LTS version) from [nodejs.org](https://nodejs.org/).
2.  **Git**: Install Git from [git-scm.com](https://git-scm.com/).
3.  **Tally Prime**: Ensure Tally Prime is running with **Developer Mode** enabled on port **9000**.
    *   *Configuration > Advanced Configuration > Tally Prime Server / ODBC Port > 9000*

## Initial Setup
1.  Clone the repository:
    ```bash
    git clone https://github.com/sahilsync07/Bizstash.git
    cd Bizstash
    ```
2.  Install dependencies:
    ```bash
    npm install
    cd dashboard
    npm install
    cd ..
    ```

## Daily Sync Routine
1.  Open Tally Prime and load the company you want to sync.
2.  Double-click **`sync_and_push.bat`** in this folder.
3.  Wait for the process to complete ("SYNC COMPLETE").

This will automatically:
*   Fetch the latest vouchers from Tally.
*   Process them into the dashboard format.
*   Push the encrypted data to GitHub.
*   Live dashboard will act ually update within minutes.

## Folder Structure
*   `tally_data/xml`: Contains the raw XML backups from Tally (organized by date). **(Ignored by Git, not pushed)**
*   `dashboard/public/data`: Contains the processed JSON for the web app.
