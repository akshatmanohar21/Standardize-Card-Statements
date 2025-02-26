# Bank Statement Standardizer

A Node.js script that standardizes bank statements from different formats into a common format.

## Usage:
------
`node script.js <input-file>`

## Example:
`node script.js HDFC-Input-Case1.csv`

## Input & Output:
--------------
**Input:**
- Takes CSV files in 4 different formats (format1, format2, format3, format4)
- Input filename should contain "Input" (e.g., HDFC-Input-Case1.csv)

**Output:**
- Creates standardized CSV with "Output" replacing "Input" in filename
- Example: HDFC-Input-Case1.csv → HDFC-Output-Case1.csv

## Output Format:
-------------
The script standardizes all inputs into the following columns:
- Date (DD-MM-YYYY)
- Transaction Description
- Debit (with 2 decimal places)
- Credit (with 2 decimal places)
- Currency (EUR/USD for international transactions)
- CardName (cardholder's name)
- Transaction (domestic/international)
- Location (extracted from description)

## Features:
---------
- Handles multiple date formats (DD-MM-YY, DD/MM/YY)
- Converts 2-digit years to 4-digit (20XX)
- Detects transaction type (domestic/international)
- Extracts currency for international transactions
- Formats amounts with 2 decimal places
- Handles credit indicators ("cr" suffix)
- Extracts location from transaction description
- Preserves cardholder names

## Supported Input Formats:
----------------------
**Format 1:**
- Date in col1
- Debit in col2
- Credit in col3
- Description in col4
- Section headers in col3

**Format 2:**
- Date in col1
- Description in col2
- Amount in col3
- Section headers in col2

**Format 3:**
- Date in col1
- Description in col2
- Debit in col3
- Credit in col4
- International marker in col3

**Format 4:**
- Description in col1
- Date in col2
- Amount in col3
- Section headers in multiple columns

## Helper Functions:
---------------
**fixDate(dateStr):**
- Fixes date format to DD-MM-YYYY
- Handles both '-' and '/' separators
- Makes 2 digit year into 4 digit
- Adds zero if needed for day/month

**parseCSV(content):**
- Splits content into rows
- Handles quoted values and trims spaces
- Returns array of objects with col1 to col5

**writeCSV(rows, headers, outputFile):**
- Writes data to csv file
- Handles header formatting
- Handles commas n quotes in values

**getLocation(description):**
- Gets location from description
- Removes currency stuff from end
- Returns last word in lowercase

**findFormat(rows):**
- Figures out which format we're dealing with
- Checks first 5 rows for patterns
- Returns format1-4 or unknown

**processTransaction(row, format, currentSection, currentName):**
- Processes each transaction based on format
- Handles different column layouts
- Formats all fields properly

**getAmount(amountStr):**
- Handles amount formatting
- Deals with credit indicators (cr)
- Adds .00 to amounts
- Returns {debit, credit} object 
