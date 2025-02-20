const fs = require('fs');

// fix the date stuff
function standardizeDate(dateStr) {
    if (dateStr.trim() === 'Date') return '';
    
    let day, month, year;
    
    if (dateStr.includes('-')) {
        [day, month, year] = dateStr.split('-').map(x => x.trim());
    } else if (dateStr.includes('/')) {
        [day, month, year] = dateStr.split('/').map(x => x.trim());
    } else {
        return dateStr;
    }

    // make 2 digit year into 4 digit
    if (year && year.length === 2) {
        year = '20' + year;
    }

    // add zero if needed
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    return `${day}-${month}-${year}`;
}

// parse the csv file
function parseCSV(content) {
    let rows = content.split('\n');
    return rows.map(row => {
        let cols = row.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
        return {
            col1: cols[0] || '',
            col2: cols[1] || '',
            col3: cols[2] || '',
            col4: cols[3] || '',
            col5: cols[4] || ''
        };
    });
}

// write data to csv
function writeCSV(rows, headers, outputFile) {
    let headerRow = headers.map(h => h.title).join(',') + '\n';
    let dataRows = rows.map(row => {
        return headers.map(h => {
            let val = row[h.id];
            // handle commas n quotes in values
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val === undefined ? '' : val;
        }).join(',');
    }).join('\n');

    fs.writeFileSync(outputFile, headerRow + dataRows);
}

// get location from desc
function getLocation(description, currentSection) {
    if (!description) return '';
    
    // remove currency stuff from end
    let cleanDesc = description.replace(/(EUR|USD)\s*$/g, '').trim();
    
    // split into words and get last one
    let words = cleanDesc.split(/\s+/);
    let lastWord = words.filter(word => word.length > 0).pop();
    
    return lastWord ? lastWord.toLowerCase() : '';
}

// figure out which format
function findFormat(rows) {
    for (let row of rows.slice(0, 5)) {
        // format4 - has Transaction Details in col1
        if (row.col1?.trim() === 'Transaction Details' && 
            row.col2?.trim() === 'Date') {
            return 'format4';
        }
        
        // format3 - check for intl transaction
        if (rows.some(r => r.col3 === 'International Transaction') &&
            rows.some(r => r.col2?.trim() === 'Transaction Description')) {
            return 'format3';
        }
        
        // format1 - domestic/intl in col3
        if (row.col3 === 'Domestic Transactions' || 
            row.col3 === 'International Transactions') {
            return 'format1';
        }
        
        // format2 - has Amount column
        if (row.col3 === 'Amount' && 
            row.col2?.trim() === 'Transaction Description') {
            return 'format2';
        }
    }
    return 'unknown';
}

// process each transaction based on its format
function processTransaction(row, format, currentSection, currentName) {
    if (!row.col1) return null;

    let transactionData = null;
    let amountData;

    switch (format) {
        case 'format4':
            if (!row.col2 || !row.col3) return null;
            amountData = getAmount(row.col3);
            
            let currencyMatch = row.col1.match(/\s+(EUR|USD)\s*$/);

            transactionData = {
                Date: standardizeDate(row.col2),
                'Transaction Description': row.col1.replace(/(EUR|USD)\s*$/, '').trim(),
                Debit: amountData.debit,
                Credit: amountData.credit,
                Currency: currencyMatch?.[1] || '',
                CardName: currentName,
                Transaction: currentSection,
                Location: getLocation(row.col1, currentSection)
            };
            break;

        case 'format1':
            if (!row.col4) return null;
            transactionData = {
                Date: standardizeDate(row.col1),
                'Transaction Description': row.col4.replace(/\s+(EUR|USD)\s*$/, '').trim(),
                Debit: row.col2 ? parseFloat(row.col2.replace(/,/g, '')).toFixed(2) || '' : '',
                Credit: row.col3 ? parseFloat(row.col3.replace(/,/g, '')).toFixed(2) || '' : '',
                Currency: currentSection === 'international' ? 
                    (row.col4.match(/\s+(EUR|USD)\s*$/)?.[1] || '') : '',
                CardName: currentName,
                Transaction: currentSection,
                Location: getLocation(row.col4, currentSection)
            };
            break;

        case 'format2':
            if (!row.col2) return null;
            amountData = getAmount(row.col3);
            transactionData = {
                Date: standardizeDate(row.col1),
                'Transaction Description': row.col2.replace(/(EUR|USD)\s*$/, '').trim(),
                Debit: amountData.debit,
                Credit: amountData.credit,
                Currency: currentSection === 'international' ? 
                    (row.col2.match(/(EUR|USD)\s*$/)?.[1] || '') : '',
                CardName: currentName,
                Transaction: currentSection,
                Location: getLocation(row.col2, currentSection)
            };
            break;

        case 'format3':
            if (!row.col2) return null;
            transactionData = {
                Date: standardizeDate(row.col1),
                'Transaction Description': row.col2.trim(),
                Debit: row.col3 ? parseFloat(row.col3.replace(/,/g, '')).toFixed(2) || '' : '',
                Credit: row.col4 ? parseFloat(row.col4.replace(/,/g, '')).toFixed(2) || '' : '',
                Currency: currentSection === 'international' ? 
                    (row.col2.match(/(EUR|USD)$/)?.[1] || '') : '',
                CardName: currentName,
                Transaction: currentSection,
                Location: getLocation(row.col2, currentSection)
            };
            break;
    }

    return transactionData;
}

// handle the amount formatting
function getAmount(amountStr) {
    if (!amountStr) return { debit: '', credit: '' };
    
    let cleanAmount = amountStr.replace(/(EUR|USD)$/g, '').trim();
    let isCredit = cleanAmount.toLowerCase().endsWith('cr');
    let amount = parseFloat(cleanAmount.replace(/cr$/i, '').replace(/,/g, ''));
    
    if (isNaN(amount)) return { debit: '', credit: '' };
    
    // add .00 to amounts
    let formattedAmount = amount.toFixed(2);
    
    return {
        debit: isCredit ? '' : formattedAmount,
        credit: isCredit ? formattedAmount : ''
    };
}

// main function that does everything
async function standardizeStatement(inputFile, outputFile) {
    // read n parse the file
    let content = fs.readFileSync(inputFile, 'utf-8');
    let rows = parseCSV(content);

    let format = findFormat(rows);

    let transactions = [];
    let currentSection = 'domestic';
    let currentName = '';

    for (let row of rows) {
        // skip blank rows
        if (!row.col1 && !row.col2 && !row.col3 && !row.col4) continue;

        // check if its a section header
        if (format === 'format4') {
            // Check for International Transactions header
            if (row.col1 === 'International Transactions' || 
                row.col2 === 'International Transactions' || 
                row.col3 === 'International Transactions') {
                currentSection = 'international';
                continue;
            }
            
            // Check for Domestic Transactions header
            if (row.col1 === 'Domestic Transactions' || 
                row.col2 === 'Domestic Transactions' || 
                row.col3 === 'Domestic Transactions' ||
                row.col5 === 'Domestic Transactions') {
                currentSection = 'domestic';
                continue;
            }
        } else if (format === 'format1' && 
            (row.col3 === 'Domestic Transactions' || row.col3 === 'International Transactions')) {
            currentSection = row.col3 === 'International Transactions' ? 'international' : 'domestic';
            continue;
        } else if (format === 'format2' && 
            (row.col2 === 'Domestic Transactions' || row.col2 === 'International Transactions')) {
            currentSection = row.col2 === 'International Transactions' ? 'international' : 'domestic';
            continue;
        } else if (format === 'format3' && row.col3 === 'International Transaction') {
            currentSection = 'international';
            continue;
        }

        // check if its a name row
        if (format === 'format1' && !row.col1 && !row.col2 && row.col3 && !row.col4) {
            currentName = row.col3.trim();
            continue;
        }

        if (format === 'format2' && !row.col1 && row.col2 && !row.col3) {
            currentName = row.col2.trim();
            continue;
        }

        if (format === 'format3' && !row.col1 && !row.col2 && row.col3 && !row.col4) {
            currentName = row.col3.trim();
            continue;
        }

        if (format === 'format4' && !row.col1 && row.col2?.trim()) {
            currentName = row.col2.trim();
            continue;
        }

        // skip header rows
        if (row.col1?.trim() === 'Transaction Details' || 
            row.col1?.trim() === 'Date' ||
            row.col2?.trim() === 'Date' ||
            row.col1?.trim() === 'Transaction Description' ||
            row.col2?.trim() === 'Transaction Description') {
            continue;
        }

        // process the transaction
        let transaction = processTransaction(row, format, currentSection, currentName);
        if (transaction) transactions.push(transaction);
    }

    // write the output file
    let headers = [
        { id: 'Date', title: 'Date' },
        { id: 'Transaction Description', title: 'Transaction Description' },
        { id: 'Debit', title: 'Debit' },
        { id: 'Credit', title: 'Credit' },
        { id: 'Currency', title: 'Currency' },
        { id: 'CardName', title: 'CardName' },
        { id: 'Transaction', title: 'Transaction' },
        { id: 'Location', title: 'Location' }
    ];

    writeCSV(transactions, headers, outputFile);
}

let inputFile = process.argv[2];

if (!inputFile) {
    process.exit(1);
}

let outputFile = inputFile.replace(/Input/, 'Output');

if (outputFile === inputFile) {
    let parts = inputFile.split('.');
    outputFile = `${parts[0]}-Output.${parts[1]}`;
}

// do the thing
standardizeStatement(inputFile, outputFile)
    .catch(() => process.exit(1));