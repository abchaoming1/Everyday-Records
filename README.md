# Everyday Records

Everyday Records is a static dashboard for Raymond's daily work information, knowledge notes, todos, and project progress.

This repository contains exported work-record data. Keep it private unless the data has been reviewed and approved for public sharing.

## What It Shows

- Daily records from `YYYY-MM-DD-工作-信息与知识.docx`
- Module and project grouping
- Search, module, project, status, and date filters
- Project-first tracker
- Todo and risk queue
- Full timeline with original information expandable per record

## Update Data

Run this from the repository root:

```powershell
python .\scripts\export_records.py --records-root ".." --output-dir ".\data"
```

Then open `index.html` directly, or serve the folder with any static server.

## GitHub Pages

This repository is a dependency-free static site. If Pages is enabled, publish from the repository root on the default branch.
