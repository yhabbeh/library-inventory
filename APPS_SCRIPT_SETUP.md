# Google Apps Script for Library Inventory System

This Google Apps Script handles order submissions from your library website and integrates with your Google Sheet inventory.

## Setup Instructions

### 1. Create the Script
1. Go to [Google Apps Script](https://script.google.com/)
2. Click "New Project"
3. Replace the default code with the code from `library-order-apps-script.js`
4. Save the project with a meaningful name like "Library Order Processor"

### 2. Configure Your Spreadsheet ID
1. Open your Google Sheet that contains your inventory
2. Copy the Spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/edit`
3. In the Apps Script editor, find the `CONFIG` object and replace `'YOUR_SPREADSHEET_ID_HERE'` with your actual Spreadsheet ID

### 3. Update Sheet Names
1. Modify the `ORDERS_SHEET_NAME` and `INVENTORY_SHEET_NAME` constants to match your sheet names
2. If you don't have an "Orders" sheet, the script will create one automatically

### 4. Deploy as Web App
1. In the Apps Script editor, click "Deploy" > "New Deployment"
2. Select "Web app" as the type
3. Fill in the description (e.g., "Library Order Handler")
4. For "Execute as", select "Me"
5. For "Who has access", select "Anyone" (or "Anyone with Google" if you prefer more security)
6. Click "Deploy"
7. Copy the deployment URL provided

### 5. Update Your Website
1. In your `src/main.js` file, find the `ORDER_ENDPOINT` constant
2. Replace the current value with your deployment URL
3. It should look something like: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

## Features

- **Order Processing**: Receives order submissions from your website
- **Inventory Updates**: Automatically reduces inventory quantities when orders are placed
- **Order Tracking**: Creates an "Orders" sheet to track all orders
- **Status Management**: Allows updating order status (Pending, Shipped, Delivered, etc.)

## Important Notes

- Make sure your Google Sheet has sharing enabled so the script can access it
- The script expects the following column structure in your inventory sheet: Title, Cost, Price, Profit, Suggestted, Quantity, Sold, Availability, Author, Category, Overview, URL
- The inventory update feature will update the "Availability", "Quantity", and "Sold" columns when orders are placed
- For security, consider restricting access to "Anyone with Google" instead of "Anyone"

## Troubleshooting

If orders aren't being processed:
1. Check that the deployment URL is correctly set in your website code
2. Verify that the Spreadsheet ID is correct
3. Ensure the Apps Script has permission to access your Google Sheet
4. Check the execution logs in Apps Script for any error messages

## Security Considerations

- The web app is accessible to anyone with the URL, so consider the implications
- You may want to add validation or authentication if needed
- Monitor your execution quotas in Google Apps Script