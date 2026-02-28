// State structure: { folders: { "Name": ["id1"] }, collapsed: { "Name": true/false } }
let state = { folders: {}, collapsed: {} };
const STORAGE_KEY = "gemini_conversation_groups";

// 1. Initialization
async function init() {
	const data = await chrome.storage.local.get(STORAGE_KEY);
	if (data[STORAGE_KEY]) state = data[STORAGE_KEY];

	injectControls();
	renderFolders();
	organizeExistingConversations();
	setupObserver(); // To handle dynamically loaded conversations
}

// 2. Core DOM Manipulation & ID Extraction
function getConversationId(itemContainer) {
	const link = itemContainer.querySelector("a");
	if (!link) return null;
	const href = link.getAttribute("href"); // e.g., /app/12345
	return href.split("/app/")[1];
}

// 3. Inject UI Controls (Buttons)
function injectControls() {
	const parent = document.querySelector(".conversations-container");
	if (!parent || document.getElementById("cg-controls")) return;

	const controlsDiv = document.createElement("div");
	controlsDiv.id = "cg-controls";

	controlsDiv.innerHTML = `
    <button id="cg-add-folder">➕ New Folder</button>
    <button id="cg-export">💾 Export</button>
    <button id="cg-import-btn">📂 Import</button>
    <input type="file" id="cg-import-file" accept=".json" style="display:none;">
  `;

	parent.prepend(controlsDiv);

	document.getElementById("cg-add-folder").addEventListener("click", () => {
		const name = prompt("Folder Name:");
		if (name && !state.folders[name]) {
			state.folders[name] = [];
			saveState();
			renderFolders();
		}
	});

	document.getElementById("cg-export").addEventListener("click", exportJSON);
	document.getElementById("cg-import-btn").addEventListener("click", () => {
		document.getElementById("cg-import-file").click();
	});
	document
		.getElementById("cg-import-file")
		.addEventListener("change", importJSON);
}

// 4. Render Folders & Drag-and-Drop
function renderFolders() {
	const parent = document.querySelector(".conversations-container");
	if (!parent) return;

	// Clean up old folders
	document.querySelectorAll(".cg-folder").forEach((el) => el.remove());

	// Ensure collapsed state object exists (for backward compatibility if upgrading)
	if (!state.collapsed) state.collapsed = {};

	Object.keys(state.folders).forEach((folderName) => {
		const folderEl = document.createElement("div");
		folderEl.className = "cg-folder";
		folderEl.dataset.folder = folderName;

		// Check if this folder should be collapsed initially
		if (state.collapsed[folderName]) {
			folderEl.classList.add("collapsed");
		}

		folderEl.innerHTML = `
      <div class="cg-folder-header">
        <div>
          <button class="cg-toggle-btn">▼</button>
          <span>📁 ${folderName}</span>
        </div>
        <button class="cg-del-folder" data-name="${folderName}">X</button>
      </div>
      <div class="cg-folder-content"></div>
    `;

		// Toggle Collapse/Expand Event
		folderEl.querySelector(".cg-toggle-btn").addEventListener("click", () => {
			folderEl.classList.toggle("collapsed");
			state.collapsed[folderName] = folderEl.classList.contains("collapsed");
			saveState();
		});

		// Drag and Drop Events for Folder
		folderEl.addEventListener("dragover", (e) => {
			e.preventDefault();
			// Optional: Auto-expand folder when dragging over it
			if (folderEl.classList.contains("collapsed")) {
				folderEl.classList.remove("collapsed");
				state.collapsed[folderName] = false;
				saveState();
			}
			folderEl.classList.add("drag-over");
		});

		folderEl.addEventListener("dragleave", () =>
			folderEl.classList.remove("drag-over"),
		);
		folderEl.addEventListener("drop", (e) =>
			handleDrop(e, folderName, folderEl),
		);

		// Delete Folder Event
		folderEl.querySelector(".cg-del-folder").addEventListener("click", (e) => {
			const name = e.target.dataset.name;
			delete state.folders[name];
			delete state.collapsed[name]; // Clean up collapsed state too
			saveState();
			location.reload();
		});

		parent.insertBefore(
			folderEl,
			document.getElementById("cg-controls").nextSibling,
		);
	});
}

function organizeExistingConversations() {
	const items = document.querySelectorAll(
		".conversations-container > .conversation-items-container",
	);

	items.forEach((item) => {
		const id = getConversationId(item);
		if (!id) return;

		// Make Draggable
		item.draggable = true;
		item.addEventListener("dragstart", (e) => {
			e.dataTransfer.setData("text/plain", id);
		});

		// Check if it belongs in a folder
		for (const [folderName, ids] of Object.entries(state.folders)) {
			if (ids.includes(id)) {
				const folderContent = document.querySelector(
					`.cg-folder[data-folder="${folderName}"] .cg-folder-content`,
				);
				if (folderContent) folderContent.appendChild(item);
				break;
			}
		}
	});
}

function handleDrop(e, targetFolderName, folderEl) {
	e.preventDefault();
	folderEl.classList.remove("drag-over");

	const id = e.dataTransfer.getData("text/plain");
	if (!id) return;

	// Remove ID from all existing folders
	for (const f in state.folders) {
		state.folders[f] = state.folders[f].filter((itemId) => itemId !== id);
	}

	// Add to new folder
	state.folders[targetFolderName].push(id);
	saveState();

	// Move in DOM visually
	const item = document
		.querySelector(`a[href="/app/${id}"]`)
		.closest(".conversation-items-container");
	if (item) {
		folderEl.querySelector(".cg-folder-content").appendChild(item);
	}
}

// 5. Observer for SPAs (Single Page Applications)
function setupObserver() {
	const parent = document.querySelector(".conversations-container");
	if (!parent) return;

	const observer = new MutationObserver((mutations) => {
		let shouldReorganize = false;
		mutations.forEach((mut) => {
			if (mut.addedNodes.length > 0) shouldReorganize = true;
		});
		if (shouldReorganize) {
			organizeExistingConversations();
		}
	});

	observer.observe(parent, { childList: true });
}

// 6. Data Management
function saveState() {
	chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function exportJSON() {
	const blob = new Blob([JSON.stringify(state, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "gemini_conversation_groups.json";
	a.click();
	URL.revokeObjectURL(url);
}

function importJSON(e) {
	const file = e.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (event) => {
		try {
			state = JSON.parse(event.target.result);
			saveState();
			renderFolders();
			location.reload(); // Quickest way to apply imported structure cleanly
		} catch (err) {
			alert("Invalid JSON file.");
		}
	};
	reader.readAsText(file);
}

// Run the script
setTimeout(init, 1000); // Slight delay to ensure DOM is fully painted
