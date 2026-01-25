# Exclude Large XML Files and Update Sync Workflow

## Goal Description
The repository currently contains raw Tally XML files that exceed GitHub's file size limits (50 MB per file, 100 MB for a single file). These files are not needed in the repo because the processed JSON data is already generated and used by the dashboard. We will:
- Stop tracking the `tally_data/xml/**` directory.
- Keep only the generated JSON files (`dashboard/public/data/**/*.json`).
- Update the sync script to stage only JSON data.
- Document the workflow for the accountant’s PC so they can generate the JSON locally and push it.
- Ensure the CI/CD pipeline continues to build and deploy the dashboard.

## User Review Required
- **Confirm** that ignoring the XML files is acceptable and that the accountant will always run the sync script locally before pushing.
- **Confirm** whether any large XML files should be stored using Git LFS instead of being ignored.

## Proposed Changes
### Files to Modify
- **`.gitignore`** – add a rule to ignore all XML files under `tally_data/xml/`.
- **`sync_and_push.bat`** – change the `git add` commands to only stage JSON data (`dashboard/public/data/**`) and optionally the `tally_data` folder if it contains only small supporting files.
- **`INSTRUCTIONS.md`** – add a section describing the accountant PC workflow (fetch → process → push).
- **`task.md`** – update checklist to mark the steps we are about to implement.

### Optional (if large XML must be versioned)
- Add a **Git LFS** configuration (`.gitattributes`) for `*.xml` files and install Git LFS on both PCs.

## Verification Plan
1. **Local .gitignore Test**
   - Run `git status` after adding a dummy large XML file under `tally_data/xml/`. Verify it does not appear in `git status`.
2. **Sync Script Test**
   - Execute `sync_and_push.bat` on a test repo with a small JSON file change. Ensure only the JSON files are staged and committed.
   - Check the commit diff (`git show`) to confirm no XML files are included.
3. **Push Test**
   - Perform a push to a temporary branch (`git push origin HEAD:test-branch`). Verify the push succeeds without size errors.
4. **CI/CD Build Test**
   - After a successful push to `main`, confirm that the GitHub Actions workflow runs and completes without errors, producing a deployable `dashboard/dist` artifact.
5. **Documentation Review**
   - Open `INSTRUCTIONS.md` and confirm the accountant workflow is clear and includes the steps:
     * Run `node fetch_tally_v2.js`.
     * Run `node process_tally_v2.js`.
     * Run `sync_and_push.bat`.

If any step fails, we will adjust the script or .gitignore accordingly.
