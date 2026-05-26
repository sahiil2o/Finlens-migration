import xlrd
import sys
import json
import uuid
import re

def parse_xls(filepath):
    try:
        workbook = xlrd.open_workbook(filepath)
    except Exception as e:
        print(json.dumps({"error": f"Failed to open workbook: {str(e)}"}))
        return

    sheet = workbook.sheet_by_index(0)

    meta = {
        "accountType": "savings",
        "accountId": "HDFC Savings Account",
        "odLimit": 0.0,
        "totalDue": 0.0,
        "stmtDate": ""
    }

    # Extract metadata
    for r in range(min(sheet.nrows, 20)):
        row_vals = [str(x).strip() for x in sheet.row_values(r)]
        row_str = " ".join(row_vals)
        
        # Account No
        acct_match = re.search(r'Account\s*No\s*:?\s*(\d+)', row_str, re.IGNORECASE)
        if acct_match:
            acct_no = acct_match.group(1)
            meta["accountId"] = f"HDFC Savings {acct_no[-4:]}"
            
        # OD Limit
        od_match = re.search(r'OD\s*Limit\s*:?\s*([\d,]+\.?\d*)', row_str, re.IGNORECASE)
        if od_match:
            val = od_match.group(1).replace(",", "")
            meta["odLimit"] = float(val)

        # Date Range
        to_date_match = re.search(r'To\s*:\s*(\d{2}/\d{2}/\d{4}|\d{2}/\d{2}/\d{2})', row_str, re.IGNORECASE)
        if to_date_match:
            meta["stmtDate"] = to_date_match.group(1)

    # Find the header row
    header_idx = -1
    for r in range(sheet.nrows):
        row_vals = [str(x).lower().strip() for x in sheet.row_values(r)]
        if "date" in row_vals and any("narration" in x or "description" in x for x in row_vals) and any("balance" in x for x in row_vals):
            header_idx = r
            break

    transactions = []
    latest_closing_bal = 0.0

    if header_idx != -1:
        header_row = [str(x).lower().strip() for x in sheet.row_values(header_idx)]
        
        date_col = header_row.index("date")
        
        desc_col = -1
        for idx, h in enumerate(header_row):
            if "narration" in h or "desc" in h:
                desc_col = idx
                break
                
        withdrawal_col = -1
        for idx, h in enumerate(header_row):
            if "withdrawal" in h or "debit" in h:
                withdrawal_col = idx
                break
                
        deposit_col = -1
        for idx, h in enumerate(header_row):
            if "deposit" in h or "credit" in h:
                deposit_col = idx
                break

        balance_col = -1
        for idx, h in enumerate(header_row):
            if "closing" in h or "balance" in h:
                balance_col = idx
                break

        for r in range(header_idx + 1, sheet.nrows):
            row_vals = sheet.row_values(r)
            if not row_vals or len(row_vals) <= max(date_col, desc_col):
                continue
            
            # Check for termination
            first_cell = str(row_vals[0]).strip()
            row_str_lower = " ".join(str(x).lower() for x in row_vals)
            if "statement summary" in row_str_lower or "end of statement" in row_str_lower:
                break

                
            # Date parse
            date_str = str(row_vals[date_col]).strip()
            if not date_str or date_str.startswith("*") or len(date_str) < 6:
                continue
                
            try:
                parts = date_str.split("/")
                day = int(parts[0])
                month = int(parts[1])
                year = int(parts[2])
                if year < 100:
                    year += 2000
                date_iso = f"{year:04d}-{month:02d}-{day:02d}"
            except Exception:
                continue
                
            desc = str(row_vals[desc_col]).strip()
            if not desc:
                continue

            # Amount
            withdrawal = 0.0
            if withdrawal_col != -1:
                val = str(row_vals[withdrawal_col]).replace(",", "").strip()
                if val:
                    try:
                        withdrawal = float(val)
                    except ValueError:
                        pass
                        
            deposit = 0.0
            if deposit_col != -1:
                val = str(row_vals[deposit_col]).replace(",", "").strip()
                if val:
                    try:
                        deposit = float(val)
                    except ValueError:
                        pass

            if not withdrawal and not deposit:
                continue
                
            is_credit = deposit > 0
            amount = deposit if is_credit else withdrawal

            closing_bal = 0.0
            if balance_col != -1:
                val = str(row_vals[balance_col]).replace(",", "").strip()
                if val:
                    try:
                        closing_bal = float(val)
                    except ValueError:
                        pass
            
            # The closing balance of the latest transaction in chronological order
            latest_closing_bal = closing_bal

            transactions.append({
                "id": str(uuid.uuid4()),
                "date": date_iso,
                "dateString": date_str,
                "description": desc,
                "amount": amount,
                "type": "credit" if is_credit else "debit",
                "category": None,
                "merchant": desc,
                "normalizedMerchant": desc.lower(),
                "sourceBank": meta["accountId"],
                "statementDate": meta["stmtDate"],
                "recurring": False,
                "aiCategorized": False
            })

    # Set closing balance as totalDue
    meta["totalDue"] = latest_closing_bal

    # Sort descending by date so newer transactions appear first in tables (consistent with HDFC Credit Card parser)
    transactions.sort(key=lambda x: x["date"], reverse=True)

    print(json.dumps({"meta": meta, "transactions": transactions}, indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
    else:
        parse_xls(sys.argv[1])
