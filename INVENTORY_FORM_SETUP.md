# Google Form for Library Inventory Management

This Google Apps Script creates a Google Form that matches your specific inventory column structure: **Title, Cost, Price, Profit, Suggestted, Quantity, Sold, Availability, Author, Category, Overview, URL**

## Setup Instructions

### 1. Create the Script
1. Go to [Google Apps Script](https://script.google.com/)
2. Click "New Project"
3. Replace the default code with the code from `inventory-management-form.js`
4. Save the project with a meaningful name like "Library Inventory Form Creator"

### 2. Configure Your Spreadsheet ID
1. Open your Google Sheet that contains your inventory
2. Copy the Spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`
3. In the Apps Script editor, find the `CONFIG` object and replace `'YOUR_SPREADSHEET_ID_HERE'` with your actual Spreadsheet ID
4. Update the `INVENTORY_SHEET_NAME` if your sheet has a different name

### 3. Run the Form Creation Function
1. In the Apps Script editor, select the function `createInventoryManagementForm()` from the dropdown menu
2. Click the "Run" button (▶️)
3. You may need to grant permissions when prompted
4. Check the execution log for the form URL

### 4. Alternative: Enhanced Form
If you want dropdown options for categories, run the `createEnhancedInventoryForm()` function instead. This version includes:
- Dropdown for common categories
- Simplified layout
- Better user experience

## Form Features

- **Matches Your Structure**: Each form field corresponds to your sheet columns
- **Required Fields**: Title is set as required
- **Field Types**: Appropriate input types (text, number, paragraph) for each column
- **Auto-Linking**: Form responses automatically go to your Google Sheet
- **Validation**: Proper field validation based on data types

## Column Mapping

The form maps directly to your columns:
1. **Title** → Short text input (required)
2. **Cost** → Number input
3. **Price** → Number input
4. **Profit** → Number input
5. **Suggestted** → Number input
6. **Quantity** → Number input
7. **Sold** → Number input
8. **Availability** → Number input
9. **Author** → Short text input
10. **Category** → Text input (or dropdown in enhanced version)
11. **Overview** → Paragraph text input
12. **URL** → Text input

## Usage

Once created, you can:
- Share the form URL with staff to add/update inventory
- View responses directly in your linked Google Sheet
- Use the form as a simple inventory management interface
- Integrate with other scripts for automated processing

## Important Notes

- The form will create responses in your existing sheet
- Make sure your sheet has headers that match the form titles
- The script requires permissions to create forms and access your spreadsheet
- Responses will be added as new rows in your sheet
- For best results, ensure your sheet has the exact column headers as specified

## Troubleshooting

If the form creation fails:
1. Check that your Spreadsheet ID is correct
2. Verify that the sheet name matches exactly
3. Ensure your Google Account has access to the spreadsheet
4. Check the execution log for specific error messages
5. Make sure you've granted all necessary permissions

## Security Considerations

- Anyone with the form URL can submit responses
- Consider using Google Forms' response restrictions if needed
- Monitor your sheet for unauthorized changes
- You may want to restrict form access to specific users