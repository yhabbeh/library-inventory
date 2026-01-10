/**
 * Google Apps Script for Library Inventory Order System
 * This script handles order submissions from your library website
 */

// Configuration - Update these with your actual values
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', // Replace with your Google Sheet ID
  ORDERS_SHEET_NAME: 'Orders', // Sheet name for orders
  INVENTORY_SHEET_NAME: 'Inventory' // Sheet name for inventory
};

/**
 * doGet - Handles GET requests for testing
 */
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <h1>Library Order Processing System</h1>
    <p>This endpoint receives order submissions from your library website.</p>
    <p>Make sure to configure the SPREADSHEET_ID in the script.</p>
  `);
}

/**
 * doPost - Main function to handle order submissions from your website
 */
function doPost(e) {
  try {
    // Parse the form data
    let params;
    if (typeof e.postData !== 'undefined' && e.postData.contents) {
      // Handle JSON data
      params = JSON.parse(e.postData.contents);
    } else {
      // Handle form data
      params = e.parameter;
    }
    
    // Validate required fields
    if (!params.name || !params.phone || !params.address || !params.items) {
      return createErrorResponse('Missing required fields');
    }
    
    // Open the target spreadsheet
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const ordersSheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME) || createOrdersSheet(ss);
    
    // Prepare the order data
    const orderData = [
      new Date(),                    // A: Timestamp
      params.name,                   // B: Customer Name
      params.phone,                  // C: Phone Number
      params.address,                // D: Delivery Address
      params.items,                  // E: Items Ordered (as text)
      params.total || '0',           // F: Total Amount
      'Pending',                     // G: Status
      params.email || '',            // H: Email (if provided)
      params.notes || ''             // I: Additional Notes
    ];
    
    // Add the order to the sheet
    const newRow = ordersSheet.appendRow(orderData);
    
    // Optionally update inventory quantities
    updateInventoryQuantities(params.items);
    
    // Return success response
    return createSuccessResponse('Order submitted successfully');
    
  } catch (error) {
    console.error('Error processing order:', error);
    return createErrorResponse(error.message);
  }
}

/**
 * Creates the Orders sheet if it doesn't exist
 */
function createOrdersSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet(CONFIG.ORDERS_SHEET_NAME);
  
  // Add headers
  const headers = [
    'Timestamp',
    'Customer Name', 
    'Phone Number',
    'Delivery Address',
    'Items Ordered',
    'Total Amount',
    'Status',
    'Email',
    'Notes'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('white');
  headerRange.setHorizontalAlignment('center');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  return sheet;
}

/**
 * Updates inventory quantities based on ordered items
 */
function updateInventoryQuantities(itemsOrdered) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const inventorySheet = ss.getSheetByName(CONFIG.INVENTORY_SHEET_NAME);

    if (!inventorySheet) {
      console.warn('Inventory sheet not found, skipping inventory update');
      return;
    }

    // Parse the items string (format: "Book Title 1 (qty 2), Book Title 2 (qty 1)")
    const items = parseItemsString(itemsOrdered);

    // Get all inventory data
    const lastRow = inventorySheet.getLastRow();
    if (lastRow <= 1) return; // No data rows

    const dataRange = inventorySheet.getRange(2, 1, lastRow - 1, inventorySheet.getLastColumn());
    const allData = dataRange.getValues();

    // Find the column indices based on your specific column structure
    const headerRow = inventorySheet.getRange(1, 1, 1, inventorySheet.getLastColumn()).getValues()[0];

    // Find column indices based on your provided structure: Title,Cost,Price,Profit,Suggestted,Quantity,Sold,Availability,Author,Category,Overview,URL
    let titleColIndex = -1;
    let availabilityColIndex = -1;
    let quantityColIndex = -1;
    let soldColIndex = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const colName = headerRow[i].toString().toLowerCase().trim();

      if (colName === 'title') {
        titleColIndex = i;
      } else if (colName === 'availability') {
        availabilityColIndex = i;
      } else if (colName === 'quantity') {
        quantityColIndex = i;
      } else if (colName === 'sold') {
        soldColIndex = i;
      }
    }

    if (titleColIndex === -1) {
      console.error('Title column not found');
      return;
    }

    if (availabilityColIndex === -1) {
      console.error('Availability column not found');
      return;
    }

    // Update quantities for each ordered item
    items.forEach(item => {
      for (let i = 0; i < allData.length; i++) {
        const rowData = allData[i];
        const title = rowData[titleColIndex];

        if (title && title.toString().toLowerCase().includes(item.title.toLowerCase())) {
          let currentAvail = parseInt(rowData[availabilityColIndex]) || 0;
          let newAvail = Math.max(0, currentAvail - item.quantity);

          // Update availability
          inventorySheet.getRange(i + 2, availabilityColIndex + 1).setValue(newAvail);

          // If there's a Quantity column, update that too
          if (quantityColIndex !== -1) {
            let currentQty = parseInt(rowData[quantityColIndex]) || 0;
            let newQty = Math.max(0, currentQty - item.quantity);
            inventorySheet.getRange(i + 2, quantityColIndex + 1).setValue(newQty);
          }

          // If there's a Sold column, update that too
          if (soldColIndex !== -1) {
            let currentSold = parseInt(rowData[soldColIndex]) || 0;
            let newSold = currentSold + item.quantity;
            inventorySheet.getRange(i + 2, soldColIndex + 1).setValue(newSold);
          }

          break;
        }
      }
    });

  } catch (error) {
    console.error('Error updating inventory:', error);
  }
}

/**
 * Parses the items string to extract titles and quantities
 */
function parseItemsString(itemsString) {
  const items = [];
  
  // Split by comma, but be careful of commas within parentheses
  const regex = /([^,()]+(?:\([^)]*\))?)+(?=\s*,\s*|$)/g;
  let match;
  
  while ((match = regex.exec(itemsString)) !== null) {
    const itemStr = match[1].trim();
    
    // Extract quantity from format like "Book Title (qty X)"
    const qtyMatch = itemStr.match(/\(qty (\d+)\)|\(quantity (\d+)\)|(\d+)\s*x/i);
    const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3]) || 1 : 1;
    
    // Remove quantity part from title
    const title = itemStr.replace(/\s*\(.+\)/, '').trim();
    
    items.push({ title, quantity });
  }
  
  return items;
}

/**
 * Creates a success response
 */
function createSuccessResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success', message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates an error response
 */
function createErrorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'error', message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper function to initialize the spreadsheet with proper structure
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Create Orders sheet if it doesn't exist
  if (!ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME)) {
    createOrdersSheet(ss);
  }
  
  console.log('Spreadsheet setup completed');
}

/**
 * Function to update order status
 */
function updateOrderStatus(timestamp, newStatus) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ordersSheet = ss.getSheetByName(CONFIG.ORDERS_SHEET_NAME);
  
  if (!ordersSheet) return;
  
  const lastRow = ordersSheet.getLastRow();
  if (lastRow <= 1) return;
  
  // Get timestamps from column A
  const timestamps = ordersSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  // Find the matching order
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i][0] instanceof Date && 
        timestamps[i][0].getTime() === new Date(timestamp).getTime()) {
      
      // Find the Status column (assumed to be column G = index 7)
      ordersSheet.getRange(i + 2, 7).setValue(newStatus);
      break;
    }
  }
}