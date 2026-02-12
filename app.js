// --- STATE MANAGEMENT ---
let transactions = JSON.parse(localStorage.getItem("bizTransactions")) || [];
let businessName = localStorage.getItem("bizName") || "My Business";
let categories = JSON.parse(localStorage.getItem("bizCategories")) || {
    "Expense": ["Milk", "Fruits", "Vegetables", "Rent", "Other"],
    "Profit": ["Online Payment", "Cash Sale"]
};

let currentType = "Expense"; 
let settingsCatType = "Expense"; // For the settings tab

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    updateUI();
    loadSettings();
    populateCategoryDropdown(); // Initial load for modal
});

// --- NAVIGATION ---
function showPage(pageId, btnElement) {
    document.querySelectorAll('.app-page').forEach(page => page.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';

    if(btnElement) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active-nav'));
        btnElement.classList.add('active-nav');
    }

    if(pageId === 'exportSection') renderPivotTable();
    if(pageId === 'settingsSection') renderCategorySettings(settingsCatType);
}

// --- CORE UI (Dashboard) ---
function updateUI(dataToRender = transactions) {
    const list = document.getElementById("transactionList");
    const totalIncomeEl = document.getElementById("totalIncomeDisplay");
    const totalExpenseEl = document.getElementById("totalExpenseDisplay");
    document.getElementById("businessNameDisplay").innerText = businessName;

    list.innerHTML = ""; 
    let totalIncome = 0, totalExpense = 0;

    // Calculate totals
    transactions.forEach(txn => {
        if(txn.type === "Profit") totalIncome += parseFloat(txn.amount);
        else totalExpense += parseFloat(txn.amount);
    });

    // Render List
    dataToRender.slice().reverse().forEach(txn => {
        const item = document.createElement("div");
        item.className = "txn-item";
        const isProfit = txn.type === "Profit";
        
        item.innerHTML = `
            <div class="txn-icon ${isProfit ? 'icon-profit' : 'icon-expense'}">
                <i class="fa-solid ${isProfit ? 'fa-qrcode' : 'fa-glass-water'}"></i>
            </div>
            <div class="txn-details">
                <div class="txn-cat">${txn.category}</div>
                <div class="txn-date">${new Date(txn.date).toLocaleDateString()}</div>
            </div>
            <div class="txn-amount ${isProfit ? 'amount-profit' : 'amount-expense'}">
                ${isProfit ? '+' : '-'} ₹${txn.amount}
            </div>
            <div onclick="deleteTxn(${txn.id})" style="color:#444; margin-left:10px; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </div>
        `;
        list.appendChild(item);
    });

    totalIncomeEl.innerText = `₹ ${totalIncome.toLocaleString()}`;
    totalExpenseEl.innerText = `₹ ${totalExpense.toLocaleString()}`;
}

// --- CATEGORY MANAGEMENT ---
function populateCategoryDropdown() {
    const select = document.getElementById("inpCategory");
    select.innerHTML = "";
    categories[currentType].forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.innerText = cat;
        select.appendChild(opt);
    });
}

function renderCategorySettings(type) {
    settingsCatType = type;
    const list = document.getElementById("categoryList");
    list.innerHTML = "";
    
    // Update Tabs
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    event.target.classList.add("active"); // Simple toggle visual

    categories[type].forEach(cat => {
        const div = document.createElement("div");
        div.className = "cat-item";
        div.innerHTML = `
            <span>${cat}</span>
            <div class="cat-actions">
                <button class="icon-btn edit-btn" onclick="renameCategory('${cat}', '${type}')"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn del-btn" onclick="deleteCategory('${cat}', '${type}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
}

function addNewCategory() {
    const input = document.getElementById("newCatInput");
    const newName = input.value.trim();
    if(!newName) return;
    
    if(!categories[settingsCatType].includes(newName)) {
        categories[settingsCatType].push(newName);
        saveCategories();
        renderCategorySettings(settingsCatType);
        input.value = "";
        populateCategoryDropdown(); // Refresh modal
    }
}

function renameCategory(oldName, type) {
    const newName = prompt("Rename Category:", oldName);
    if(newName && newName !== oldName) {
        // 1. Update List
        const idx = categories[type].indexOf(oldName);
        if(idx !== -1) categories[type][idx] = newName;
        
        // 2. Update Historical Transactions (Crucial!)
        transactions.forEach(t => {
            if(t.category === oldName && t.type === type) t.category = newName;
        });
        
        saveData();
        saveCategories();
        renderCategorySettings(type);
        populateCategoryDropdown();
        updateUI(); // Refresh dashboard names
    }
}

function deleteCategory(name, type) {
    if(confirm(`Delete '${name}'? (History remains, but removed from list)`)) {
        categories[type] = categories[type].filter(c => c !== name);
        saveCategories();
        renderCategorySettings(type);
        populateCategoryDropdown();
    }
}

function saveCategories() {
    localStorage.setItem("bizCategories", JSON.stringify(categories));
}

// --- PIVOT TABLE ENGINE (The "Desktop App" Logic) ---
function renderPivotTable() {
    if(transactions.length === 0) return;

    // 1. Group by Date
    const grouped = {};
    const allDates = new Set();
    const expCats = new Set(); // To track which columns we need
    const profitCats = new Set();

    transactions.forEach(t => {
        const dateKey = new Date(t.date).toLocaleDateString();
        allDates.add(dateKey);
        
        if(!grouped[dateKey]) grouped[dateKey] = { Expense: {}, Profit: {} };
        
        if(t.type === "Expense") {
            grouped[dateKey].Expense[t.category] = (grouped[dateKey].Expense[t.category] || 0) + parseFloat(t.amount);
            expCats.add(t.category);
        } else {
            grouped[dateKey].Profit[t.category] = (grouped[dateKey].Profit[t.category] || 0) + parseFloat(t.amount);
            profitCats.add(t.category);
        }
    });

    // 2. Sort Columns & Dates
    const sortedDates = Array.from(allDates).sort((a,b) => new Date(a) - new Date(b)); // Oldest first
    const sortedExpCats = Array.from(expCats).sort();
    const sortedProfitCats = Array.from(profitCats).sort();

    // 3. Build Header
    const thead = document.getElementById("previewHead");
    let headerHTML = `<tr><th>Date</th>`;
    
    sortedExpCats.forEach(c => headerHTML += `<th style="color:#ff5252">${c}</th>`);
    headerHTML += `<th class="col-total">Total Exp</th>`;
    
    sortedProfitCats.forEach(c => headerHTML += `<th style="color:#00e676">${c}</th>`);
    headerHTML += `<th class="col-total">Total Inc</th>`;
    
    headerHTML += `<th class="col-margin">Net Margin</th></tr>`;
    thead.innerHTML = headerHTML;

    // 4. Build Body
    const tbody = document.getElementById("previewBody");
    tbody.innerHTML = "";

    sortedDates.forEach(date => {
        const rowData = grouped[date];
        let rowHTML = `<tr><td>${date}</td>`;
        
        let dailyExp = 0;
        let dailyInc = 0;

        // Expense Cols
        sortedExpCats.forEach(cat => {
            const val = rowData.Expense[cat] || 0;
            dailyExp += val;
            rowHTML += `<td>${val ? val : '-'}</td>`;
        });
        rowHTML += `<td class="col-total">${dailyExp}</td>`;

        // Profit Cols
        sortedProfitCats.forEach(cat => {
            const val = rowData.Profit[cat] || 0;
            dailyInc += val;
            rowHTML += `<td>${val ? val : '-'}</td>`;
        });
        rowHTML += `<td class="col-total">${dailyInc}</td>`;

        // Margin
        const margin = dailyInc - dailyExp;
        rowHTML += `<td class="col-margin" style="color:${margin >= 0 ? '#2979ff' : 'red'}">${margin}</td></tr>`;
        
        tbody.innerHTML += rowHTML;
    });
}

// --- EXCEL EXPORT (Table to File) ---
function downloadExcel() {
    const table = document.getElementById("previewTable");
    const workbook = XLSX.utils.table_to_book(table, {sheet: "Daily Summary"});
    XLSX.writeFile(workbook, `BizTrack_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// --- ADD TRANSACTION LOGIC ---
function saveTransaction() {
    const amount = document.getElementById("inpAmount").value;
    const category = document.getElementById("inpCategory").value;

    if (!amount || amount <= 0) return alert("Enter valid amount");

    const newTxn = {
        id: Date.now(),
        date: new Date().toISOString(),
        amount: amount,
        type: currentType,
        category: category
    };

    transactions.push(newTxn);
    saveData();
    closeAddModal();
    updateUI();
    document.getElementById("inpAmount").value = "";
}

// --- HELPERS ---
function deleteTxn(id) {
    if(confirm("Delete this transaction?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        updateUI();
    }
}
function saveData() { localStorage.setItem("bizTransactions", JSON.stringify(transactions)); }
function loadSettings() { document.getElementById("settingBizName").value = businessName; }
function saveSettings() {
    const newName = document.getElementById("settingBizName").value;
    if(newName) {
        businessName = newName;
        localStorage.setItem("bizName", newName);
        updateUI();
        alert("Saved!");
    }
}
function clearAllData() {
    if(confirm("Have you exported your Excel file yet?\n\nThis will DELETE all current transactions to start a fresh month.")) {
        transactions = [];
        saveData();
        updateUI();
        renderPivotTable();
        alert("Data Cleared. Ready for the new month!");
    }
}
function openAddModal() { 
    populateCategoryDropdown(); // Refresh cats
    document.getElementById("addModal").style.display = "flex"; 
}
function closeAddModal() { document.getElementById("addModal").style.display = "none"; }
function setType(type) {
    currentType = type;
    document.getElementById("btnExpense").classList.toggle("active", type === "Expense");
    document.getElementById("btnProfit").classList.toggle("active", type === "Profit");
    populateCategoryDropdown(); // Refresh cats for selected type
}
window.onclick = function(e) { if(e.target == document.getElementById("addModal")) closeAddModal(); }

// --- 1. SEARCH LOGIC (Updated to handle Date) ---
function filterTransactions() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const dateQuery = document.getElementById("searchDate").value; // Format: YYYY-MM-DD

    const filtered = transactions.filter(t => {
        // Text Match (Category or Amount)
        const matchesText = t.category.toLowerCase().includes(query) || 
                            t.amount.toString().includes(query);
        
        // Date Match
        let matchesDate = true;
        if (dateQuery) {
            // Convert transaction ISO date to YYYY-MM-DD for comparison
            const txnDate = new Date(t.date).toISOString().split('T')[0];
            matchesDate = (txnDate === dateQuery);
        }

        return matchesText && matchesDate;
    });

    updateUI(filtered);
}

// --- 2. MODAL LOGIC (Updated to set Default Date) ---
function openAddModal() {
    populateCategoryDropdown();
    
    // Set Date input to Today (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("inpDate").value = today;
    
    document.getElementById("addModal").style.display = "flex";
}

// --- 3. SAVE LOGIC (Updated to use Custom Date) ---
function saveTransaction() {
    const amount = document.getElementById("inpAmount").value;
    const category = document.getElementById("inpCategory").value;
    const customDate = document.getElementById("inpDate").value; // YYYY-MM-DD

    if (!amount || amount <= 0) return alert("Enter valid amount");
    if (!customDate) return alert("Please select a date");

    // Create a Date object from the input
    // We append the current time to preserve sorting order if multiple entries occur on same day
    const currentTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
    const finalDateISO = new Date(`${customDate}T${currentTime}`).toISOString();

    const newTxn = {
        id: Date.now(),
        date: finalDateISO,
        amount: amount,
        type: currentType,
        category: category
    };

    transactions.push(newTxn);
    saveData();
    closeAddModal();
    updateUI();
    
    // Clear inputs
    document.getElementById("inpAmount").value = "";
}

// --- PIVOT TABLE ENGINE (With Grand Totals) ---
function renderPivotTable() {
    if(transactions.length === 0) return;

    // 1. Group by Date
    const grouped = {};
    const allDates = new Set();
    const expCats = new Set();
    const profitCats = new Set();

    transactions.forEach(t => {
        const dateKey = new Date(t.date).toLocaleDateString();
        allDates.add(dateKey);
        
        if(!grouped[dateKey]) grouped[dateKey] = { Expense: {}, Profit: {} };
        
        if(t.type === "Expense") {
            grouped[dateKey].Expense[t.category] = (grouped[dateKey].Expense[t.category] || 0) + parseFloat(t.amount);
            expCats.add(t.category);
        } else {
            grouped[dateKey].Profit[t.category] = (grouped[dateKey].Profit[t.category] || 0) + parseFloat(t.amount);
            profitCats.add(t.category);
        }
    });

    // 2. Sort Columns & Dates
    const sortedDates = Array.from(allDates).sort((a,b) => new Date(a) - new Date(b));
    const sortedExpCats = Array.from(expCats).sort();
    const sortedProfitCats = Array.from(profitCats).sort();

    // --- INITIALIZE COLUMN TOTALS TRACKER ---
    let colTotals = {
        Expense: {}, // Stores total for each expense category
        Profit: {},  // Stores total for each profit category
        TotalExp: 0,
        TotalInc: 0,
        NetMargin: 0
    };
    // Initialize specific category counters to 0
    sortedExpCats.forEach(c => colTotals.Expense[c] = 0);
    sortedProfitCats.forEach(c => colTotals.Profit[c] = 0);

    // 3. Build Header
    const thead = document.getElementById("previewHead");
    let headerHTML = `<tr><th style="background:#333; color:white;">Date</th>`;
    
    sortedExpCats.forEach(c => headerHTML += `<th style="color:#ff5252">${c}</th>`);
    headerHTML += `<th class="col-total">Total Exp</th>`;
    
    sortedProfitCats.forEach(c => headerHTML += `<th style="color:#00e676">${c}</th>`);
    headerHTML += `<th class="col-total">Total Inc</th>`;
    
    headerHTML += `<th class="col-margin">Net Margin</th></tr>`;
    thead.innerHTML = headerHTML;

    // 4. Build Body
    const tbody = document.getElementById("previewBody");
    tbody.innerHTML = "";

    sortedDates.forEach(date => {
        const rowData = grouped[date];
        let rowHTML = `<tr><td>${date}</td>`;
        
        let dailyExp = 0;
        let dailyInc = 0;

        // Expense Cols
        sortedExpCats.forEach(cat => {
            const val = rowData.Expense[cat] || 0;
            dailyExp += val;
            colTotals.Expense[cat] += val; // Add to Column Total
            rowHTML += `<td>${val ? val : '-'}</td>`;
        });
        colTotals.TotalExp += dailyExp; // Add to Grand Total Expense
        rowHTML += `<td class="col-total">${dailyExp}</td>`;

        // Profit Cols
        sortedProfitCats.forEach(cat => {
            const val = rowData.Profit[cat] || 0;
            dailyInc += val;
            colTotals.Profit[cat] += val; // Add to Column Total
            rowHTML += `<td>${val ? val : '-'}</td>`;
        });
        colTotals.TotalInc += dailyInc; // Add to Grand Total Income
        rowHTML += `<td class="col-total">${dailyInc}</td>`;

        // Margin
        const margin = dailyInc - dailyExp;
        colTotals.NetMargin += margin; // Add to Grand Total Margin
        rowHTML += `<td class="col-margin" style="color:${margin >= 0 ? '#2979ff' : 'red'}">${margin}</td></tr>`;
        
        tbody.innerHTML += rowHTML;
    });

    // 5. BUILD THE "TOTAL" ROW (The Footer)
    let footerHTML = `<tr style="background-color: #444; font-weight: bold; border-top: 2px solid white;">`;
    footerHTML += `<td style="color: #FFD700;">TOTAL</td>`; // Gold color for "TOTAL" label

    // Total for each Expense Category
    sortedExpCats.forEach(cat => {
        footerHTML += `<td>${colTotals.Expense[cat]}</td>`;
    });
    // Grand Total Expense
    footerHTML += `<td class="col-total" style="color:#ff5252">${colTotals.TotalExp}</td>`;

    // Total for each Profit Category
    sortedProfitCats.forEach(cat => {
        footerHTML += `<td>${colTotals.Profit[cat]}</td>`;
    });
    // Grand Total Income
    footerHTML += `<td class="col-total" style="color:#00e676">${colTotals.TotalInc}</td>`;

    // Grand Net Margin
    footerHTML += `<td class="col-margin" style="color:${colTotals.NetMargin >= 0 ? '#2979ff' : 'red'}">${colTotals.NetMargin}</td>`;
    
    footerHTML += `</tr>`;
    tbody.innerHTML += footerHTML;
}