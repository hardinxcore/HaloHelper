async function getOptions() {
    // Get local storage
    let localstorage = await chrome.storage.local.get();

    // Populate settings with default values if they are undefined (but don't overwrite existing values)
    const needsUpdate = 
        localstorage.haloDomain === undefined ||
        localstorage.haloAddFormattedCopyButton === undefined ||
        localstorage.haloTicketHistoryMax === undefined;

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

        // Save changes only if needed
        await chrome.storage.local.set(localstorage);
    }

    // Set the page's options to what is stored in local storage
    document.getElementById('haloDomainTextBox').value = localstorage.haloDomain || '';
    document.getElementById('haloAddFormattedCopyButtonCheckbox').checked = localstorage.haloAddFormattedCopyButton;
    document.getElementById('haloTicketHistoryMaxTextBox').value = localstorage.haloTicketHistoryMax;
}

async function setOptions() {
    // Halo
    let haloDomain = document.getElementById('haloDomainTextBox').value.trim();
    let haloAddFormattedCopyButton = document.getElementById('haloAddFormattedCopyButtonCheckbox').checked;
    let haloTicketHistoryMax = document.getElementById('haloTicketHistoryMaxTextBox').value;

    let localStorage = {
        'haloDomain': haloDomain,
        'haloAddFormattedCopyButton': haloAddFormattedCopyButton,
        'haloTicketHistoryMax': haloTicketHistoryMax
    };

    await chrome.storage.local.set(localStorage);
    chrome.permissions.request({ origins: ['*://*.halopsa.com/*', '*://*.haloitsm.com/*'] });
}

document.addEventListener('DOMContentLoaded', getOptions);
document.querySelector('#resetButton').addEventListener('click', getOptions);
document.querySelector('#saveButton').addEventListener('click', setOptions);