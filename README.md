# Halo Helper

A modern Chrome / Microsoft Edge extension designed to improve the workflow for engineers using **HaloPSA** and **HaloITSM**. It seamlessly adds helpful shortcuts and copy tools directly into the Halo interface.

*(This extension is open-source and can be easily configured to work with any HaloPSA or HaloITSM tenant domain).*

## ✨ Features

- **Quick Copy Buttons**: Adds specialized buttons next to the "Share" button on any Ticket page to instantly copy:
  - Formatted Ticket Link (`TICKETID // CustomerID // ORGANIZATION NAME // TICKET TITLE`)
  - Ticket Number only
  - CustomerID (smartly extracted via APIs and DOM reading)
- **Omnibox Search Integration**: Type `HA` followed by a space and a ticket number in your browser's address bar to instantly jump to that ticket in HaloPSA.
- **Ticket History**: Click on the extension icon to see a quick popup with your 10 most recently visited tickets.
- **Bulk Plan Date Update**: Select tickets on any ticket list page, open the native **Edit** dropdown, and choose **Set Plandate** (or **Set Plandatum** in Dutch). A modal shows each ticket's summary and current plan date. Set an absolute date or use the **+1 / +7 / +14** shift buttons to move the date relative to the current value. The modal automatically inherits the active HaloPSA theme (light or dark).
- **Secure & Fast**: Uses native Manifest V3 `MutationObserver` and Chrome's `ClipboardItem` API for instant, seamless integration. Authentication with the Halo API runs via your own active browser session cookies.

## 🚀 Installation (Developer Mode)

Since this extension is not published on the Chrome Web Store, you can install it manually in developer mode:

1. Download or git clone this repository to a folder on your computer.
2. Open Google Chrome (or Microsoft Edge) and go to `chrome://extensions/` (or `edge://extensions/`).
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the folder containing the `manifest.json` file of this repository.

## ⚙️ Configuration

1. Click on the extension icon in your browser toolbar.
2. Select **Options**.
3. **Important:** Enter your company's specific Halo domain in the "Halo/ITSM Domain" input field (e.g., `company.halopsa.com`). 
4. Here you can also tweak:
   - Whether the custom copy buttons should be rendered on ticket pages.
   - The maximum amount of recent tickets saved in your history (default: 10).

## � Changelog

### v1.6 — April 2026
- **Bulk Plan Date in Edit menu**: The bulk plan date action now lives inside HaloPSA's native **Edit** dropdown (no more floating button). Label adapts to the UI language (English / Dutch).
- **Theme-aware modal**: The plan date modal automatically inherits the active HaloPSA theme (light or dark) so it blends with the rest of the UI.
- **Summary & current Plandatum in modal**: The modal table now shows each ticket's summary text and current plan date value, so you can make informed decisions.
- **Relative shift buttons (+1 / +7 / +14)**: Shift the plan date relative to the current value (or today when empty). The computed date is shown in the date picker before you apply.
- **Per-ticket updates with verification**: Each ticket is updated individually with response verification for reliable error reporting.

### v1.3 — April 2026
- **CustomerID added to copy format**: The formatted ticket link now includes `CFCustomerExternalReference` (external customer reference) as the CustomerID segment: `TICKETID // CustomerID // ORGANIZATION NAME // TICKET TITLE`.
- **Ticket history updated**: The popup ticket history now shows the same 4-part format including CustomerID.
- **Bulk Plan Date**: Initial release of the bulk plan date update feature for ticket list pages.

## �🔒 Privacy & Permissions

This extension runs completely locally in your browser. It does not contain telemetry, tracking, or outside analytics.
- `storage`: Used to save your settings and local ticket history.
- `cookies`: Used by the Service Worker to securely interface with the HaloPSA API natively.
- `tabs`/`scripting`: Used to understand when a ticket page has loaded dynamically in the Single Page Application (SPA), in order to inject the helpful copy buttons.
