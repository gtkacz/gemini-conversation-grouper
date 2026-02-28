# gemini-conversation-grouper# Gemini Conversation Grouper

A lightweight, vanilla JavaScript browser extension that allows users to organize their Google Gemini conversations into custom, collapsible folders. Built with a native-feeling Material Design UI.

## Features

* **Custom Folders:** Create, name, and delete folders to group your chats.
* **Drag and Drop:** Intuitively drag conversations into folders.
* **Collapsible UI:** Keep your sidebar clean by collapsing folders you aren't actively using.
* **Multi-Account Support:** Automatically segregates folder data based on the currently logged-in Google account.
* **Import/Export:** Back up your folder structure to a JSON file and restore it anywhere.
* **Native Look & Feel:** Seamlessly matches Gemini's Material Design interface and automatically adapts to your system's Light/Dark mode.
* **Privacy First:** 100% local. All data is saved directly to your browser's local storage (`chrome.storage.local`). No external servers are used.

## Installation (Developer Mode)

1. Clone or download this repository to your local machine.
2. Open your Chromium-based browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click **Load unpacked** and select the directory containing this extension.
5. Open [Gemini](https://gemini.google.com) to see the extension in action.

## Tech Stack

* Vanilla JavaScript
* Standard CSS (CSS Variables, Flexbox, Media Queries)
* Manifest V3
* Chrome Storage API

## Usage

* Click **New Folder** to create a group.
* Drag any conversation from the sidebar into the folder.
* Click the chevron arrow next to a folder name to collapse or expand it.
* Click the **Export** icon to download a backup of your structure.
* Click the **Import** icon to load a previous backup.

## License

MIT License.
