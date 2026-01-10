/**
 * Google Apps Script for Library Inventory Management Form
 * Creates a Google Form that matches your specific column structure
 */

// Configuration - Update these with your actual values
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', // Replace with your Google Sheet ID
  INVENTORY_SHEET_NAME: 'Inventory', // Your inventory sheet name
  FORM_TITLE: 'Library Inventory Management', // Title for the form
  FORM_DESCRIPTION: 'Form for managing library inventory. Matches the column structure: Title, Cost, Price, Profit, Suggestted, Quantity, Sold, Availability, Author, Category, Overview, URL.'
};

/**
 * Creates a Google Form that matches your inventory sheet structure
 */
function createInventoryManagementForm() {
  try {
    // Create a new form
    const form = FormApp.create(CONFIG.FORM_TITLE);
    form.setDescription(CONFIG.FORM_DESCRIPTION);
    form.setConfirmationMessage('Thank you for updating the inventory!');
    
    // Get the spreadsheet to link with
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.INVENTORY_SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`Sheet '${CONFIG.INVENTORY_SHEET_NAME}' not found in the spreadsheet`);
    }
    
    // Add form items based on your column structure
    addFormItems(form);
    
    // Link the form to the sheet
    form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.SPREADSHEET_ID);
    
    const formUrl = form.getPublishedUrl();
    console.log('Form created successfully!');
    console.log('Form URL:', formUrl);
    
    return formUrl;
  } catch (error) {
    console.error('Error creating form:', error);
    throw error;
  }
}

/**
 * Adds form items based on your specific column structure
 */
function addFormItems(form) {
  // 1. Title (Short Answer)
  form.addTextItem()
    .setTitle('Title')
    .setHelpText('Enter the book title')
    .setRequired(true);
  
  // 2. Cost (Text - for numbers)
  form.addTextItem()
    .setTitle('Cost')
    .setHelpText('Enter the cost of the book')
    .setRequired(false);

  // 3. Price (Text - for numbers)
  form.addTextItem()
    .setTitle('Price')
    .setHelpText('Enter the selling price of the book')
    .setRequired(false);

  // 4. Profit (Text - for numbers)
  form.addTextItem()
    .setTitle('Profit')
    .setHelpText('Calculated profit (Price - Cost)')
    .setRequired(false);

  // 5. Suggestted (Text - for numbers)
  form.addTextItem()
    .setTitle('Suggestted')
    .setHelpText('Suggested retail price')
    .setRequired(false);

  // 6. Quantity (Text - for numbers)
  form.addTextItem()
    .setTitle('Quantity')
    .setHelpText('Total quantity in stock')
    .setRequired(false);

  // 7. Sold (Text - for numbers)
  form.addTextItem()
    .setTitle('Sold')
    .setHelpText('Number of items sold')
    .setRequired(false);

  // 8. Availability (Text - for numbers)
  form.addTextItem()
    .setTitle('Availability')
    .setHelpText('Number of items currently available')
    .setRequired(false);
  
  // 9. Author (Short Answer)
  form.addTextItem()
    .setTitle('Author')
    .setHelpText('Enter the author name(s)')
    .setRequired(false);
  
  // 10. Category (Short Answer or Multiple Choice)
  const categoryItem = form.addTextItem()
    .setTitle('Category')
    .setHelpText('Enter the category (e.g., Fiction, Non-Fiction, Science, etc.)')
    .setRequired(false);
  
  // 11. Overview (Paragraph)
  form.addParagraphTextItem()
    .setTitle('Overview')
    .setHelpText('Brief description or overview of the book')
    .setRequired(false);
  
  // 12. URL (Text - for links)
  form.addTextItem()
    .setTitle('URL')
    .setHelpText('Link to book cover image or additional information')
    .setRequired(false);
}

/**
 * Alternative function to create a form with dropdown options for common fields
 */
function createEnhancedInventoryForm() {
  try {
    // Create a new form
    const form = FormApp.create(CONFIG.FORM_TITLE + ' - Enhanced');
    form.setDescription(CONFIG.FORM_DESCRIPTION + '\n\nThis enhanced version includes dropdowns for common selections.');
    form.setConfirmationMessage('Thank you for updating the inventory!');
    
    // Add form items with enhanced options
    addEnhancedFormItems(form);
    
    // Link the form to the sheet
    form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.SPREADSHEET_ID);
    
    const formUrl = form.getPublishedUrl();
    console.log('Enhanced form created successfully!');
    console.log('Form URL:', formUrl);
    
    return formUrl;
  } catch (error) {
    console.error('Error creating enhanced form:', error);
    throw error;
  }
}

/**
 * Adds enhanced form items with dropdowns for common selections
 */
function addEnhancedFormItems(form) {
  // 1. Title (Short Answer)
  form.addTextItem()
    .setTitle('Title')
    .setHelpText('Enter the book title')
    .setRequired(true);
  
  // 2. Author (Short Answer)
  form.addTextItem()
    .setTitle('Author')
    .setHelpText('Enter the author name(s)')
    .setRequired(false);
  
  // 3. Category (Multiple Choice)
  const categoryItem = form.addListItem()
    .setTitle('Category')
    .setHelpText('Select the category')
    .setChoiceValues([
      'Uncategorized',
      'Fiction',
      'Non-Fiction',
      'Science',
      'Technology',
      'Biography',
      'History',
      'Religion/Islamic',
      'Self-Help',
      'Children',
      'Academic',
      'Other'
    ]);
  
  // 4. Cost (Text - for numbers)
  form.addTextItem()
    .setTitle('Cost')
    .setHelpText('Enter the cost of the book')
    .setRequired(false);

  // 5. Price (Text - for numbers)
  form.addTextItem()
    .setTitle('Price')
    .setHelpText('Enter the selling price of the book')
    .setRequired(false);

  // 6. Suggestted (Text - for numbers)
  form.addTextItem()
    .setTitle('Suggestted')
    .setHelpText('Suggested retail price')
    .setRequired(false);

  // 7. Quantity (Text - for numbers)
  form.addTextItem()
    .setTitle('Quantity')
    .setHelpText('Total quantity in stock')
    .setRequired(false);

  // 8. Availability (Text - for numbers)
  form.addTextItem()
    .setTitle('Availability')
    .setHelpText('Number of items currently available')
    .setRequired(false);

  // 9. Sold (Text - for numbers)
  form.addTextItem()
    .setTitle('Sold')
    .setHelpText('Number of items sold')
    .setRequired(false);
  
  // 10. Overview (Paragraph)
  form.addParagraphTextItem()
    .setTitle('Overview')
    .setHelpText('Brief description or overview of the book')
    .setRequired(false);
  
  // 11. URL (Text - for links)
  form.addTextItem()
    .setTitle('URL')
    .setHelpText('Link to book cover image or additional information')
    .setRequired(false);
}

/**
 * Function to initialize the script with proper configuration
 */
function initializeFormCreation() {
  console.log('To create the inventory management form:');
  console.log('1. Update the CONFIG object with your actual Spreadsheet ID');
  console.log('2. Run the createInventoryManagementForm() function');
  console.log('3. Or run createEnhancedInventoryForm() for dropdown options');
  
  // Example of how to call the function:
  // createInventoryManagementForm();
}

/**
 * doGet - Handles GET requests for testing
 */
function doGet(e) {
  return HtmlService.createHtmlOutput(`
    <h1>Library Inventory Form Creator</h1>
    <p>This script creates a Google Form that matches your inventory sheet structure.</p>
    <p>To create the form, run the <code>createInventoryManagementForm()</code> function in the Apps Script editor.</p>
    <p>Your column structure: Title, Cost, Price, Profit, Suggestted, Quantity, Sold, Availability, Author, Category, Overview, URL</p>
  `);
}