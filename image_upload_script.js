/**
 * IMAGE UPLOAD HANDLER
 * Deploy this as a Web App:
 * 1. Execute as: "Me" (your account)
 * 2. Who has access: "Anyone"
 */

const UPLOAD_CONFIG = {
    // REPLACE WITH YOUR FOLDER ID (Open Drive folder, copy ID from URL)
    FOLDER_ID: '1c-gbl4KGE58imfOPox9A3Mq18PLNEGiJ',

    // REPLACE WITH YOUR SHEET ID
    SPREADSHEET_ID: '1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0',
    SHEET_NAME: 'Sheet1'
};

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        if (data.action === 'upload') {
            return handleImageUpload(data);
        }

        return createResponse({ status: 'error', message: 'Unknown action' });

    } catch (error) {
        return createResponse({ status: 'error', message: error.toString() });
    }
}

function handleImageUpload(data) {
    const folder = DriveApp.getFolderById(UPLOAD_CONFIG.FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.image), data.mimeType, data.filename);
    const file = folder.createFile(blob);

    // Set permissions so it's viewable
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Get direct link or view link
    // Note: 'getDownloadUrl' or constructing it manually is often better for direct embedding
    // For images, we often want the 'thumbnailLink' (if big enough) or a direct ID link.
    // Using the standard webContentLink is usually safe for "download", but for "image src" it can be tricky.
    // Best generic format: https://lh3.googleusercontent.com/d/FILE_ID

    // Use the reliable direct link format for img tags
    const fileUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

    // Update Spreadsheet
    updateSheetWithImage(data.bookTitle, fileUrl);

    return createResponse({
        status: 'success',
        url: fileUrl,
        fileId: file.getId()
    });
}

function updateSheetWithImage(bookTitle, imageUrl) {
    const ss = SpreadsheetApp.openById(UPLOAD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(UPLOAD_CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find columns
    const titleCol = headers.findIndex(h => h.trim().toLowerCase() === 'title');
    // We will assume 'Availability' column is used for image URL as per existing logic,
    // OR we can prefer to put it in a dedicated 'Image' column if it exists.
    // The user requirement said: "in sheet should add url for this image uploaded"
    // The current code reads image from 'Availability' if it starts with http.
    // Let's stick to that for now unless there's a better column.

    let targetCol = headers.findIndex(h => h.trim().toLowerCase() === 'link' || h.trim().toLowerCase() === 'url');

    // Safety check: if link column is missing, maybe we should NOT fallback randomly, but let's assume one exists or create it?
    // User specifically asked for "link" column.
    if (targetCol === -1) {
        // Optional: Auto-create column? Apps Script can do that.
        // For now, let's keep the logic safe but inform via logs if possible.
        // Fallback to last column + 1? No, better not mess up data. 
        // Let's assume user has a column named Link.
        // We can return error or create it. Let's create it if missing? 
        // createResponse might be better to return specific error.
        // However, to be safe and simple:

        // Try to find empty column? No.
        // Let's fallback to column index 11 (L) or similar if we knew the structure.
        // But safer to just fail gracefully or try to append?
        // Let's try to append a header if it doesn't exist?
        sheet.getRange(1, headers.length + 1).setValue('Link');
        targetCol = headers.length; // The new column index
        // Refresh data? No need, just set val.
    }

    for (let i = 1; i < data.length; i++) {
        // Fuzzy title match or exact?
        // Let's do exact match first, then normalized
        if (data[i][titleCol] === bookTitle) {
            sheet.getRange(i + 1, targetCol + 1).setValue(imageUrl);
            return;
        }
    }
}

function createResponse(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
    return createResponse({ status: 'alive', message: 'Upload service is running' });
}
