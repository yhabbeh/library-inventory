
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/export?format=csv';

async function run() {
    try {
        const response = await fetch(SHEET_URL);
        const csvData = await response.text();
        const books = parseCSV(csvData);

        console.log("Total books parsed:", books.length);
        if (books.length > 0) {
            console.log("First book:", JSON.stringify(books[0], null, 2));
            console.log("Second book:", JSON.stringify(books[1], null, 2));

            // Check headers mapping
            const lines = csvData.split('\n');
            const headers = lines[0].split(',');
            console.log("Headers:", headers);
            console.log("Header Count:", headers.length);

            // detailed check of first row
            if (lines.length > 1) {
                const firstRow = parseCSVLine(lines[1]);
                console.log("First Row Indices:");
                firstRow.forEach((val, idx) => console.log(`${idx}: ${val}`));
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function parseCSV(csv) {
    const lines = csv.split('\n');
    const result = [];
    // Headers: Title,Cost,Price,Profit,Suggestted,Availability,Quantity,Column 11,Author,Category,Overview
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const currentLine = parseCSVLine(lines[i]);
        if (currentLine.length < 2) continue;

        const book = {
            title: currentLine[0] || 'Unknown Title',
            cost: currentLine[1],
            price: currentLine[4], // "Suggestted" column at index 4
            profit: currentLine[3],
            availability: currentLine[5], // "Availability" column at index 5
            author: currentLine[8] || '', // Author at index 8 (UPDATED)
            category: formatCategory(currentLine[9], currentLine[0]), // "Category" at index 9 (UPDATED)
            image: null,
            isPlaceholder: true
        };

        if (book.availability && book.availability.startsWith('http')) {
            book.image = book.availability;
            book.isPlaceholder = false;
            book.availability = '1';
        }

        result.push(book);
    }
    return result;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function formatCategory(cat, title) {
    return cat;
}

run();
