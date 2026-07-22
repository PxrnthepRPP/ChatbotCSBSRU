$printCss = @"

/* ============================================================
   PRINT STYLESHEET (Optimized for Academic Tables)
   ============================================================ */
@media print {
    body {
        background: #fff;
        color: #000;
    }
    
    .sidebar,
    .topbar,
    .sidebar-overlay,
    .chatbot-fab,
    .chatbot-window,
    .impersonation-banner,
    #themeToggleBtn,
    .batch-filter-bar {
        display: none !important;
    }
    
    .main-content {
        margin-left: 0 !important;
        padding: 0 !important;
        background: transparent !important;
    }
    
    .module-header h2 {
        color: #000;
    }
    
    .card {
        border: none;
        box-shadow: none;
        background: transparent;
        padding: 0;
        margin-bottom: 20px;
    }
    
    /* Ensure tables do not break awkwardly */
    .data-table,
    .tt-schedule-grid,
    table,
    .advisee-card,
    .profile-top {
        page-break-inside: avoid;
    }
    
    .badge {
        border: 1px solid #ccc;
        color: #000 !important;
        background: transparent !important;
    }
}
"@

Add-Content -Path "c:\xampp\htdocs\ChatbotCSBSRU\css\main.css" -Value $printCss
Write-Host "Print stylesheet added."
