async function getOptions() {
    const manifestVersion = chrome.runtime.getManifest().version;
    const versionLabel = document.getElementById('extensionVersionLabel');
    if (versionLabel) {
        versionLabel.textContent = `Version: ${manifestVersion}`;
    }

    // Get local storage
    let localstorage = await chrome.storage.local.get();

    // Populate settings with default values if they are undefined (but don't overwrite existing values)
    const needsUpdate =
        localstorage.haloDomain === undefined ||
        localstorage.haloAddFormattedCopyButton === undefined ||
        localstorage.haloTicketHistoryMax === undefined ||
        localstorage.haloPlanDateEnabled === undefined ||
        localstorage.haloPlanDateFieldId === undefined ||
        localstorage.haloPlanDateFieldName === undefined ||
        localstorage.haloPlanDateDashes === undefined;

    if (needsUpdate) {
        if (localstorage.haloDomain === undefined) {
            localstorage.haloDomain = '';  // Empty domain for open source users
        }
        if (localstorage.haloAddFormattedCopyButton === undefined) {
            localstorage.haloAddFormattedCopyButton = true;
        }
        if (localstorage.haloTicketHistoryMax === undefined) {
            localstorage.haloTicketHistoryMax = 10;
        }
        if (localstorage.haloPlanDateEnabled === undefined) {
            localstorage.haloPlanDateEnabled = true;
        }
        if (localstorage.haloPlanDateFieldId === undefined) {
            localstorage.haloPlanDateFieldId = 239;
        }
        if (localstorage.haloPlanDateFieldName === undefined) {
            localstorage.haloPlanDateFieldName = 'Plandatum';
        }
        if (localstorage.haloPlanDateDashes === undefined) {
            localstorage.haloPlanDateDashes = true;
        }

        // Save changes only if needed
        await chrome.storage.local.set(localstorage);
    }

    // Set the page's options to what is stored in local storage
    document.getElementById('haloDomainTextBox').value = localstorage.haloDomain || '';
    document.getElementById('haloAddFormattedCopyButtonCheckbox').checked = localstorage.haloAddFormattedCopyButton;
    document.getElementById('haloTicketHistoryMaxTextBox').value = localstorage.haloTicketHistoryMax;
    document.getElementById('haloPlanDateEnabledCheckbox').checked = localstorage.haloPlanDateEnabled;
    document.getElementById('haloPlanDateFieldIdTextBox').value = localstorage.haloPlanDateFieldId;
    document.getElementById('haloPlanDateFieldNameTextBox').value = localstorage.haloPlanDateFieldName || 'Plandatum';
    document.getElementById('haloPlanDateDashesCheckbox').checked = localstorage.haloPlanDateDashes;
}

async function setOptions() {
    // Halo
    let haloDomain = document.getElementById('haloDomainTextBox').value.trim();
    let haloAddFormattedCopyButton = document.getElementById('haloAddFormattedCopyButtonCheckbox').checked;
    let haloTicketHistoryMax = document.getElementById('haloTicketHistoryMaxTextBox').value;

    let haloPlanDateEnabled = document.getElementById('haloPlanDateEnabledCheckbox').checked;
    let haloPlanDateFieldId = parseInt(document.getElementById('haloPlanDateFieldIdTextBox').value, 10) || 239;
    let haloPlanDateFieldName = document.getElementById('haloPlanDateFieldNameTextBox').value.trim() || 'Plandatum';
    let haloPlanDateDashes = document.getElementById('haloPlanDateDashesCheckbox').checked;

    let localStorage = {
        'haloDomain': haloDomain,
        'haloAddFormattedCopyButton': haloAddFormattedCopyButton,
        'haloTicketHistoryMax': haloTicketHistoryMax,
        'haloPlanDateEnabled': haloPlanDateEnabled,
        'haloPlanDateFieldId': haloPlanDateFieldId,
        'haloPlanDateFieldName': haloPlanDateFieldName,
        'haloPlanDateDashes': haloPlanDateDashes
    };

    await chrome.storage.local.set(localStorage);
    chrome.permissions.request({ origins: ['*://*.halopsa.com/*', '*://*.haloitsm.com/*'] });
}

document.addEventListener('DOMContentLoaded', getOptions);
document.querySelector('#resetButton').addEventListener('click', getOptions);
document.querySelector('#saveButton').addEventListener('click', setOptions);