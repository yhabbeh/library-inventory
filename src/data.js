export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/gviz/tq?tqx=out:csv&sheet=Sheet1';

export async function fetchBooksData() {
    // Add timestamp to bypass caching
    const url = `${SHEET_URL}&_t=${Date.now()}`;
    const response = await fetch(url);
    const csvData = await response.text();
    let books = parseCSV(csvData);

    // Apply local overrides (instant updates)
    books = applyLocalOverrides(books);

    return books;
}

export function saveLocalImageOverride(title, imageUrl) {
    try {
        const overrides = JSON.parse(localStorage.getItem('library_image_overrides') || '{}');
        overrides[title] = imageUrl;
        localStorage.setItem('library_image_overrides', JSON.stringify(overrides));
    } catch (e) {
        console.warn('Failed to save local override', e);
    }
}

function applyLocalOverrides(books) {
    try {
        const overrides = JSON.parse(localStorage.getItem('library_image_overrides') || '{}');
        return books.map(book => {
            if (overrides[book.title]) {
                book.image = overrides[book.title];
                // Check if it is a google drive link to normalize it
                if (book.image.includes('drive.google') || book.image.includes('googleusercontent')) {
                    book.image = normalizeGoogleDriveImage(book.image);
                }
                book.isPlaceholder = false;
            }
            return book;
        });
    } catch (e) {
        console.warn('Failed to apply local overrides', e);
        return books;
    }
}

export function normalizeAvailability(availabilityValue) {
    if (!availabilityValue) return '0'; // Treat empty as not available

    const stringValue = availabilityValue.toString().trim();

    // If it's a number, treat as quantity
    const numValue = parseInt(stringValue);
    if (!isNaN(numValue)) {
        // If quantity is greater than 0, it's available
        return numValue > 0 ? '1' : '0';
    }

    // Handle text values
    const normalizedValue = stringValue.toLowerCase();

    // Common positive indicators
    if (normalizedValue === '1' ||
        normalizedValue === 'true' ||
        normalizedValue === 'yes' ||
        normalizedValue === 'available' ||
        normalizedValue === 'in stock' ||
        normalizedValue === 'instock' ||
        normalizedValue === 'onhand' ||
        normalizedValue === 'active') {
        return '1';
    }

    // Common negative indicators
    if (normalizedValue === '0' ||
        normalizedValue === 'false' ||
        normalizedValue === 'no' ||
        normalizedValue === 'not available' ||
        normalizedValue === 'out of stock' ||
        normalizedValue === 'outofstock' ||
        normalizedValue === 'discontinued' ||
        normalizedValue === 'inactive') {
        return '0';
    }

    // Default to not available if uncertain
    return '0';
}

export function parseCSV(csv) {
    const lines = csv.split('\n');
    const result = [];
    // Use the robust parser for headers too, in case of quotes
    const headers = parseCSVLine(lines[0]);

    // Find column indices dynamically
    const titleIndex = headers.findIndex(header => header.trim().toLowerCase() === 'title');
    const costIndex = headers.findIndex(header => header.trim().toLowerCase() === 'cost');
    const priceIndex = headers.findIndex(header => header.trim().toLowerCase() === 'price');
    const profitIndex = headers.findIndex(header => header.trim().toLowerCase() === 'profit');
    const suggestedIndex = headers.findIndex(header => header.trim().toLowerCase() === 'suggestted' || header.trim().toLowerCase() === 'suggested');
    const availabilityIndex = headers.findIndex(header => header.trim().toLowerCase() === 'availability');
    const quantityIndex = headers.findIndex(header => header.trim().toLowerCase() === 'quantity');
    const authorIndex = headers.findIndex(header => header.trim().toLowerCase() === 'author');
    const categoryIndex = headers.findIndex(header => header.trim().toLowerCase() === 'category');
    const overviewIndex = headers.findIndex(header => header.trim().toLowerCase() === 'overview');
    const linkIndex = headers.findIndex(header => header.trim().toLowerCase() === 'link' || header.trim().toLowerCase() === 'url');

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const currentLine = parseCSVLine(lines[i]);
        if (currentLine.length < 2) continue;

        const rawAvailability = availabilityIndex !== -1 ? currentLine[availabilityIndex] : currentLine[5];
        const linkValue = linkIndex !== -1 ? currentLine[linkIndex] : null;

        // Parse the availability value to determine both status and quantity
        let availabilityStatus = '0'; // Default to not available
        let availabilityQuantity = 0; // Default quantity

        if (rawAvailability && rawAvailability.startsWith('http')) {
            // If it's a URL, treat as available and set quantity to 1
            availabilityStatus = '1';
            availabilityQuantity = 1;
        } else {
            // Parse the availability value
            const parsedValue = rawAvailability ? rawAvailability.toString().trim() : '';
            const numValue = parseInt(parsedValue);

            if (!isNaN(numValue)) {
                // It's a number - use it as quantity
                availabilityQuantity = numValue;
                availabilityStatus = numValue > 0 ? '1' : '0';
            } else {
                // It's text - normalize it
                availabilityStatus = normalizeAvailability(rawAvailability);
                availabilityQuantity = availabilityStatus === '1' ? 1 : 0; // Default to 1 if available, 0 if not
            }
        }

        const book = {
            title: titleIndex !== -1 ? currentLine[titleIndex] || 'Unknown Title' : currentLine[0] || 'Unknown Title',
            cost: costIndex !== -1 ? currentLine[costIndex] : currentLine[1],
            price: suggestedIndex !== -1 ? currentLine[suggestedIndex] : (priceIndex !== -1 ? currentLine[priceIndex] : currentLine[4]), // "Suggestted" column at index 4
            profit: profitIndex !== -1 ? currentLine[profitIndex] : currentLine[3],
            availability: availabilityStatus, // '1' if available, '0' if not
            availabilityQuantity: availabilityQuantity, // Actual quantity available
            author: authorIndex !== -1 ? currentLine[authorIndex] || '' : currentLine[7] || '', // Author
            category: categoryIndex !== -1 ? formatCategory(currentLine[categoryIndex], currentLine[titleIndex !== -1 ? titleIndex : 0]) : formatCategory(currentLine[8], currentLine[0]), // "Category"
            image: null,
            isPlaceholder: true
        };

        // Heuristic: If raw availability column starts with http, it's a manual image URL
        // OR checks the new Link column
        if (linkValue && linkValue.startsWith('http')) {
            book.image = normalizeGoogleDriveImage(linkValue);
            book.isPlaceholder = false;
        } else if (rawAvailability && rawAvailability.startsWith('http')) {
            book.image = normalizeGoogleDriveImage(rawAvailability);
            book.isPlaceholder = false;
        }

        result.push(book);
    }
    return result;
}

export function normalizeGoogleDriveImage(url) {
    if (!url) return null;
    if (!url.includes('drive.google') && !url.includes('googleusercontent')) return url;

    // Extract ID
    let id = null;

    // Pattern 1: id=XXXX
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
        id = idMatch[1];
    } else {
        // Pattern 2: /d/XXXX/
        const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (dMatch) {
            id = dMatch[1];
        }
    }

    if (id) {
        // Return high-res thumbnail link (reliable for embedding)
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }

    return url;
}

// Simple CSV line parser to handle quotes/commas
export function parseCSVLine(line) {
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

export function formatCategory(cat, title) {
    if (!cat || cat === 'غير مصنف' || cat === 'Uncategorized') {
        // Basic heuristic categorization
        if (title.includes('رواية')) return 'رواية / أدب';
        if (title.includes('فقه') || title.includes('شرح')) return 'إسلامي / فقه';
        if (title.includes('سيرة')) return 'سيرة نبوية';
        if (title.includes('تطوير') || title.includes('الذات')) return 'تنمية بشرية';
        return 'General';
    }
    return cat;
}

export function processCategories(allBooks, allLabel) {
    const uniqueFullCats = [...new Set(allBooks.map(b => b.category).filter(Boolean))];

    // 1. Identify potential parents (roots)
    const parents = new Set();
    const orphans = [];

    uniqueFullCats.forEach(cat => {
        if (cat.includes(' / ')) {
            parents.add(cat.split(' / ')[0].trim());
        } else {
            orphans.push(cat);
        }
    });

    // Add self-contained categories if they are substrings of others
    orphans.forEach(orphan => {
        const isParent = uniqueFullCats.some(c => c !== orphan && c.includes(orphan));
        if (isParent) parents.add(orphan);
    });

    const subCats = {}; // Parent -> Set of { label, value }
    const hierarchy = {}; // FullCat -> Parent

    uniqueFullCats.forEach(fullCat => {
        let assignedParent = null;
        let displayLabel = fullCat;

        // 1. Explicit slash check
        if (fullCat.includes(' / ')) {
            const parts = fullCat.split(' / ');
            assignedParent = parts[0].trim();
            displayLabel = parts.slice(1).join(' / ').trim();
        }
        // 2. Fuzzy match
        else {
            const potential = Array.from(parents).filter(p => fullCat.includes(p) && fullCat !== p);
            if (potential.length > 0) {
                potential.sort((a, b) => b.length - a.length);
                assignedParent = potential[0];
                displayLabel = fullCat.replace(assignedParent, '').trim();
            }
        }

        // 3. Fallback
        if (!assignedParent) {
            assignedParent = fullCat;
            displayLabel = null;
        }

        hierarchy[fullCat] = assignedParent;

        if (!subCats[assignedParent]) subCats[assignedParent] = [];

        if (displayLabel) {
            displayLabel = displayLabel.replace(/^[\/\-\s]+|[\/\-\s]+$/g, '');
            if (displayLabel) {
                subCats[assignedParent].push({ label: displayLabel, value: fullCat });
            }
        }
    });

    // Finalize
    const uniqueParents = [...new Set(Object.values(hierarchy))].sort();
    const categories = [allLabel, ...uniqueParents];

    const subCategoriesMap = {};

    for (const [p, list] of Object.entries(subCats)) {
        const uniqueChildren = [];
        const seen = new Set();
        list.forEach(item => {
            if (!seen.has(item.label)) {
                seen.add(item.label);
                uniqueChildren.push(item);
            }
        });
        subCategoriesMap[p] = uniqueChildren.sort((a, b) => a.label.localeCompare(b.label));
    }

    return { categories, subCategoriesMap, categoryHierarchy: hierarchy };
}
