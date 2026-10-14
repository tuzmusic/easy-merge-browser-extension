# Future ideas

- **Smarter wildcard detection.** v1 only matches `_ALLCAPS`. Later, detect things that *might* be
  wildcards (`{{x}}`, `[NAME]`, `<company>`, `XXX`, `___`) and offer them in the dialog, and/or learn
  from the user's local history of wildcards so the dialog anticipates what they usually use.
- **Merge extras.** Copy inline images to each merged email; paste rows from CSV/a spreadsheet; per-row preview.
- **Editable aliases.** Options page for which wildcard names map to first name / company.
- **Persistent last-values.** v1 remembers last values for the tab only; `chrome.storage.local` would persist.
- **Better company guess.** Handle multi-part public suffixes properly and known-company overrides.
