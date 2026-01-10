/**
 * Google Apps Script for handling form submissions and adding data to Google Sheet
 * This script should be deployed as a web app to receive form submissions
 */

// Spreadsheet configuration
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Replace with your actual spreadsheet ID
const SHEET_NAME = 'Sheet1'; // Replace with your actual sheet name

/**
 * doGet - Handles GET requests (for testing the deployment)
 */
function doGet(e) {
  return HtmlService.createHtmlOutput('<h1>Form Submission Handler is Ready!</h1>');
}

/**
 * doPost - Handles POST requests from the form
 */
function doPost(e) {
  try {
    // Parse the incoming request
    const params = JSON.parse(e.postData.contents);
    
    // Or if it's form data:
    // const params = e.parameter;
    
    // Open the target spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    // Prepare the row data based on your sheet structure
    // Adjust these field names to match your form fields and sheet columns
    const rowData = [
      new Date(), // Timestamp
      params.name || '',
      params.email || '',
      params.phone || '',
      params.address || '',
      params.items || '',
      params.total || '',
      params.notes || ''
    ];
    
    // Add the row to the sheet
    sheet.appendRow(rowData);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({result: 'success', message: 'Order submitted successfully'}))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error('Error processing form submission:', error);
    
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({result: 'error', message: error.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Function to add a new field/column to the sheet
 */
function addFieldToSheet(fieldName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  // Get the current number of columns
  const lastColumn = sheet.getLastColumn();
  
  // Add the field name to the header row (row 1)
  sheet.getRange(1, lastColumn + 1).setValue(fieldName);
  
  // Log the action
  console.log(`Added new field: ${fieldName} at column ${lastColumn + 1}`);
}

/**
 * Function to initialize the sheet with required columns
 */
function initializeSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  // Define the required headers based on your form
  const headers = [
    'Timestamp',
    'Name',
    'Email',
    'Phone',
    'Address',
    'Items Ordered',
    'Total Amount',
    'Notes',
    'Status'
  ];
  
  // Check if headers already exist (by checking if row 1 is empty)
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const isEmpty = firstRow.every(cell => cell === '');
  
  if (isEmpty) {
    // Add headers to the first row
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format the header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
  }
  
  console.log('Sheet initialized with required headers');
}

/**
 * Function to update order status
 */
function updateOrderStatus(orderId, newStatus) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  // Assuming the status column is the last column
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  
  // Find the order by timestamp or other identifier
  // This is a simplified version - you might need to adjust based on your data structure
  const timestamps = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i][0].getTime() === orderId.getTime()) {
      // Update the status in the last column
      sheet.getRange(i + 2, lastColumn).setValue(newStatus);
      break;
    }
  }
}