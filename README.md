# Halo Helper

A modern Chrome / Microsoft Edge extension designed to improve the workflow for engineers using **HaloPSA** and **HaloITSM**. It seamlessly adds helpful shortcuts and copy tools directly into the Halo interface.

*(This extension is open-source and can be easily configured to work with any HaloPSA or HaloITSM tenant domain).*

## ✨ Features

- **Quick Copy Buttons**: Adds specialized buttons next to the "Share" button on any Ticket page to instantly copy:
  - Formatted Ticket Link (`TICKETID // ORGANIZATION NAME // TICKET TITLE`)
  - Ticket Number only
  - Customer Account ID (smartly extracted via APIs and DOM reading)
- **Omnibox Search Integration**: Type `HA` followed by a space and a ticket number in your browser's address bar to instantly jump to that ticket in HaloPSA.
- **Ticket History**: Click on the extension icon to see a quick popup with your 10 most recently visited tickets.
- **Secure & Fast**: Uses native Manifest V3 `MutationObserver` and Chrome's `ClipboardItem` API for instant, seamless integration. Authentication with the Halo API runs via your own active browser session cookies.

## 🚀 Installation (Developer Mode)

Since this extension is not published on the Chrome Web Store, you can install it manually in developer mode:

1. Download or git clone this repository to a folder on your computer.
2. Open Google Chrome (or Microsoft Edge) and go to `chrome://extensions/` (or `edge://extensions/`).
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** (of *Uitgepakte extensie laden*).
5. Select the folder containing the `manifest.json` file of this repository.

## ⚙️ Configuration

1. Click on the extension icon in your browser toolbar.
2. Select **Options** (of *Opties*).
3. **Important:** Enter your company's specific Halo domain in the "Halo/ITSM Domain" input field (e.g., `company.halopsa.com`). 
4. Here you can also tweak:
   - Whether the custom copy buttons should be rendered on ticket pages.
   - The maximum amount of recent tickets saved in your history (default: 10).

## 🔒 Privacy & Permissions

This extension runs completely locally in your browser. It does not contain telemetry, tracking, or outside analytics.
- `storage`: Used to save your settings and local ticket history.
- `cookies`: Used by the Service Worker to securely interface with the HaloPSA API natively.
- `tabs`/`scripting`: Used to understand when a ticket page has loaded dynamically in the Single Page Application (SPA), in order to inject the helpful copy buttons.
