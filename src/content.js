let state = { folders: {} };
const STORAGE_KEY = "gemini_conversation_groups";

// Material Design SVG Icons
const icons = {
	add: `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
	folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
	delete: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
	export: `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
	import: `<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>`,
	chevron: `<svg viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>`,
	check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
	cancel: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
	search: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
	help: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>`,
	refresh: `<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
};

// 1. Initialization
function determineUserKey() {
	// Attempt 1: Find the Google Account button and extract the email
	// The aria-label usually looks like: "Google Account: John Doe (john@email.com)"
	const accountNode = document.querySelector('[aria-label^="Google Account:"]');
	if (accountNode) {
		const label = accountNode.getAttribute("aria-label");
		const emailMatch = label.match(/\(([^)]+)\)/); // Extracts text inside parentheses
		if (emailMatch && emailMatch[1]) {
			return `conversation_groups_${emailMatch[1]}`;
		}
	}

	// Attempt 2: Check the URL for a multi-login index (e.g., gemini.google.com/u/1/)
	const urlMatch = window.location.pathname.match(/\/u\/(\d+)/);
	if (urlMatch) {
		return `conversation_groups_u${urlMatch[1]}`;
	}

	// Fallback if we can't find an identifier
	return "conversation_groups_default";
}

async function init() {
	// 1. Figure out who is logged in
	currentUserStorageKey = determineUserKey();

	// 2. Fetch data specific to this user
	const data = await chrome.storage.local.get(currentUserStorageKey);

	if (data[currentUserStorageKey]) {
		state = data[currentUserStorageKey];

		// Legacy migration (keeps working for the new user-specific states)
		if (state.collapsed) {
			const newFolders = {};
			for (const [name, items] of Object.entries(state.folders)) {
				if (Array.isArray(items)) {
					newFolders[name] = {
						items: items,
						collapsed: !!state.collapsed[name],
					};
				} else {
					newFolders[name] = items;
				}
			}
			state.folders = newFolders;
			delete state.collapsed;
			await saveState();
		}
	} else {
		// If no data exists for this user, start fresh
		state = { folders: {} };
	}

	injectControls();
	renderFolders();
	organizeExistingConversations();
	setupObserver();
}

// 2. Core DOM Manipulation & ID Extraction
function getConversationId(itemContainer) {
	const link = itemContainer.querySelector("a");
	if (!link) return null;
	const href = link.getAttribute("href"); // e.g., /app/12345
	return href.split("/app/")[1];
}

function normalizeText(text) {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getConversationTitle(itemContainer) {
	const link = itemContainer.querySelector("a");
	if (!link) return "";
	return link.textContent.trim();
}

// 3. Inject UI Controls (Buttons)
function injectControls() {
	const parent = document.querySelector(".conversations-container");
	if (!parent || document.getElementById("cg-controls")) return;

	const controlsDiv = document.createElement("div");
	controlsDiv.id = "cg-controls";

	controlsDiv.innerHTML = `
    <button id="cg-add-folder" class="cg-btn">${icons.add} New Folder</button>
    <button id="cg-export" class="cg-icon-only-btn" title="Export JSON">${icons.export}</button>
    <button id="cg-import-btn" class="cg-icon-only-btn" title="Import JSON">${icons.import}</button>
    <input type="file" id="cg-import-file" accept=".json" style="display:none;">
  `;

	parent.prepend(controlsDiv);

	// 1. Inline Input Logic for New Folder
	document.getElementById("cg-add-folder").addEventListener("click", (e) => {
		e.preventDefault();

		// Prevent multiple inputs from spawning
		if (document.getElementById("cg-new-folder-input")) return;

		const inputWrapper = document.createElement("div");
		inputWrapper.className = "cg-inline-input-wrapper";
		inputWrapper.id = "cg-new-folder-input";

		inputWrapper.innerHTML = `
      <span class="cg-folder-icon">${icons.folder}</span>
      <input type="text" placeholder="Folder name..." />
      <button class="cg-icon-btn confirm" title="Create">${icons.check}</button>
      <button class="cg-icon-btn cancel" title="Cancel">${icons.cancel}</button>
    `;

		// Insert the input field right below the controls bar
		parent.insertBefore(inputWrapper, controlsDiv.nextSibling);

		const input = inputWrapper.querySelector("input");
		input.focus(); // Auto-focus the input

		const submitFolder = async () => {
			const name = input.value.trim();
			if (name && !state.folders[name]) {
				// Use the new nested object structure!
				state.folders[name] = { items: [], collapsed: false };
				await saveState();
				renderFolders();
			} else if (state.folders[name]) {
				alert("A folder with that name already exists!");
			}
			inputWrapper.remove();
		};

		// Listeners for the check, cancel, and the Enter key
		inputWrapper
			.querySelector(".confirm")
			.addEventListener("click", submitFolder);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") submitFolder();
		});
		inputWrapper
			.querySelector(".cancel")
			.addEventListener("click", () => inputWrapper.remove());
	});

	// 2. Import/Export Listeners
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

	// Clean up old folders before rendering
	document.querySelectorAll(".cg-folder").forEach((el) => el.remove());
	if (!state.collapsed) state.collapsed = {};

	Object.keys(state.folders).forEach((folderName) => {
		const folderEl = document.createElement("div");
		folderEl.className = "cg-folder";
		if (state.folders[folderName].collapsed) {
			folderEl.classList.add("collapsed");
		}
		folderEl.dataset.folder = folderName;

		folderEl.innerHTML = `
      <div class="cg-folder-header">
        <div class="cg-folder-header-left">
          <button class="cg-icon-btn cg-chevron">${icons.chevron}</button>
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="cg-folder-icon">${icons.folder}</span>
            ${folderName}
          </span>
        </div>
        <div class="cg-folder-header-right" style="display:flex; gap:4px;">
            <button class="cg-icon-btn cg-search-folder" title="Search to Add">
                ${icons.search}
            </button>
            <button class="cg-icon-btn cg-del-folder" data-name="${folderName}" title="Delete Folder">
                ${icons.delete}
            </button>
        </div>
      </div>
      <div class="cg-folder-search" style="display:none; padding:8px 16px; border-bottom:1px solid var(--cg-border);">
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <input type="text" class="cg-search-input" placeholder="Search loaded conversations..." style="flex:1; padding:6px; border:1px solid var(--cg-border); border-radius:4px; background:var(--cg-bg); color:var(--cg-text);">
            <button class="cg-icon-btn cg-refresh-search" title="Refresh loaded conversations">${icons.refresh}</button>
            <div class="cg-tooltip-container" style="position:relative; display:inline-flex;">
                <span class="cg-icon-btn cg-help-icon" style="cursor:help;">${icons.help}</span>
                <div class="cg-tooltip" style="display:none; position:absolute; right:0; top:100%; width:200px; background:var(--cg-bg); border:1px solid var(--cg-border); padding:8px; border-radius:4px; z-index:10; font-size:12px; box-shadow:0 2px 4px var(--cg-shadow); color:var(--cg-text);">
                    Only conversations currently loaded in the page (DOM) can be searched. Scroll down to load more.
                </div>
            </div>
        </div>
        <div class="cg-search-results" style="max-height:150px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>
      </div>
      <div class="cg-folder-content"></div>
    `;

		// Search Logic
		const searchBtn = folderEl.querySelector(".cg-search-folder");
		const searchPanel = folderEl.querySelector(".cg-folder-search");
		const searchInput = folderEl.querySelector(".cg-search-input");
		const refreshBtn = folderEl.querySelector(".cg-refresh-search");
		const helpIcon = folderEl.querySelector(".cg-help-icon");
		const tooltip = folderEl.querySelector(".cg-tooltip");
		const resultsContainer = folderEl.querySelector(".cg-search-results");

		searchBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const isHidden = searchPanel.style.display === "none";
			searchPanel.style.display = isHidden ? "block" : "none";
			if (isHidden) {
				searchInput.focus();
				// Expand folder if collapsed
				if (folderEl.classList.contains("collapsed")) {
					folderEl.classList.remove("collapsed");
					state.folders[folderName].collapsed = false;
					saveState();
				}
				updateSearchResults();
			}
		});

		helpIcon.addEventListener("mouseenter", () => (tooltip.style.display = "block"));
		helpIcon.addEventListener("mouseleave", () => (tooltip.style.display = "none"));

		function updateSearchResults() {
			const query = normalizeText(searchInput.value);
			resultsContainer.innerHTML = "";

			if (!query) return;

			// Find all conversation items that are NOT in any folder (or at least not in THIS folder)
			// Actually, we should look at ALL items in the DOM, but prioritize those not in this folder.
			// The user wants to "add" them. So we should list items that can be moved here.
			const allItems = document.querySelectorAll(
				".conversations-container > .conversation-items-container",
			);
			const matches = [];

			allItems.forEach((item) => {
				const id = getConversationId(item);
				if (!id) return;
				
				// Skip if already in this folder
				if (state.folders[folderName].items.includes(id)) return;

				const title = getConversationTitle(item);
				if (normalizeText(title).includes(query)) {
					matches.push({ id, title, element: item });
				}
			});

			if (matches.length === 0) {
				resultsContainer.innerHTML = `<div style="padding:4px; color:var(--cg-text-muted); font-size:12px;">No matches found.</div>`;
				return;
			}

			matches.forEach((match) => {
				const div = document.createElement("div");
				div.className = "cg-search-result-item";
				div.style.cssText =
					"padding:4px 8px; cursor:pointer; border-radius:4px; font-size:13px; display:flex; align-items:center; gap:8px; color:var(--cg-text);";
				div.innerHTML = `<span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${match.title}</span> <span style="color:var(--cg-blue); font-size:16px;">+</span>`;

				div.addEventListener("mouseenter", () =>
					div.style.backgroundColor = "var(--cg-bg-hover)"
				);
				div.addEventListener("mouseleave", () =>
					div.style.backgroundColor = "transparent"
				);

				div.addEventListener("click", async () => {
					// Move item to folder logic
					// Remove from old location
					for (const f in state.folders) {
						state.folders[f].items = state.folders[f].items.filter(
							(itemId) => itemId !== match.id,
						);
					}
					// Add to this folder
					state.folders[folderName].items.push(match.id);
					await saveState();

					// Move DOM element
					folderEl.querySelector(".cg-folder-content").appendChild(match.element);

					// Remove from search results
					div.remove();
					if (resultsContainer.children.length === 0) {
						resultsContainer.innerHTML = `<div style="padding:4px; color:var(--cg-text-muted); font-size:12px;">No more matches.</div>`;
					}
				});

				resultsContainer.appendChild(div);
			});
		}

		searchInput.addEventListener("input", updateSearchResults);
		refreshBtn.addEventListener("click", updateSearchResults);

		// 1. Toggle Collapse/Expand Event
		folderEl
			.querySelector(".cg-chevron")
			.addEventListener("click", async () => {
				folderEl.classList.toggle("collapsed");
				state.folders[folderName].collapsed =
					folderEl.classList.contains("collapsed");
				await saveState();
			});

		// 2. Drag and Drop Events
		folderEl.addEventListener("dragover", async (e) => {
			e.preventDefault();
			if (folderEl.classList.contains("collapsed")) {
				folderEl.classList.remove("collapsed");
				state.folders[folderName].collapsed = false;
				await saveState();
			}
			folderEl.classList.add("drag-over");
		});

		folderEl.addEventListener("dragleave", () =>
			folderEl.classList.remove("drag-over"),
		);
		folderEl.addEventListener("drop", (e) =>
			handleDrop(e, folderName, folderEl),
		);

		// 3. Delete Folder Event (No Reload!)
		folderEl
			.querySelector(".cg-del-folder")
			.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopPropagation();

				const name = e.currentTarget.dataset.name;

				const userConfirmed = window.confirm(
					`Are you sure you want to delete the "${name}" folder? Your conversations will move back to the main list.`,
				);

				if (userConfirmed) {
					// 1. Find the items inside this folder
					const folderContent = folderEl.querySelector(".cg-folder-content");
					const items = Array.from(folderContent.children);

					// 2. Move them back to the main container
					// We'll insert them right after the last folder so they appear at the top of the un-grouped list
					const lastFolder = Array.from(
						document.querySelectorAll(".cg-folder"),
					).pop();
					const insertAnchor = lastFolder
						? lastFolder.nextSibling
						: document.getElementById("cg-controls").nextSibling;

					items.forEach((item) => {
						parent.insertBefore(item, insertAnchor);
					});

					// 3. Remove the folder visually from the DOM
					folderEl.remove();

					// 4. Update the state and save
					delete state.folders[name];
					await saveState();
				}
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

		item.draggable = true;
		item.addEventListener("dragstart", (e) => {
			e.dataTransfer.setData("text/plain", id);
		});

		for (const [folderName, folderData] of Object.entries(state.folders)) {
			if (folderData.items.includes(id)) {
				const folderContent = document.querySelector(
					`.cg-folder[data-folder="${folderName}"] .cg-folder-content`,
				);
				if (folderContent) folderContent.appendChild(item);
				break;
			}
		}
	});
}

async function handleDrop(e, targetFolderName, folderEl) {
	e.preventDefault();
	folderEl.classList.remove("drag-over");

	const id = e.dataTransfer.getData("text/plain");
	if (!id) return;

	// Remove ID from old location using the new structure
	for (const f in state.folders) {
		state.folders[f].items = state.folders[f].items.filter(
			(itemId) => itemId !== id,
		);
	}

	// Add to new folder
	state.folders[targetFolderName].items.push(id);
	await saveState();

	// Visually append DOM node
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
async function saveState() {
	// Save using the dynamic key so users don't overwrite each other
	await chrome.storage.local.set({ [currentUserStorageKey]: state });
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
