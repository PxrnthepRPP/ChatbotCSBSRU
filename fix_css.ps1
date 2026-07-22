$filePath = "c:\xampp\htdocs\ChatbotCSBSRU\css\main.css"
$content = Get-Content $filePath -Raw

# The bug: after body.dark-theme closes at "}" on its own line,
# there are orphaned CSS properties (--sidebar-w, --topbar-h, etc.) 
# that need to be inside :root.
# We need to:
# 1. Find the `:root {` block and inject the missing vars before it closes
# 2. Remove the orphaned vars and their stray closing brace

# Step 1: Find the orphaned block and extract it
$orphanPattern = '(?ms)(--g-900:\s*#ffffff;\s*\r?\n\})\s*\r?\n(\s+--sidebar-w:.*?--t-spring:.*?;\s*\r?\n\})'
$match = [regex]::Match($content, $orphanPattern)

if ($match.Success) {
    # Extract the orphaned vars (without the stray closing brace)
    $orphanedBlock = $match.Groups[2].Value
    # Remove the stray closing brace at the end of the orphaned block
    $orphanedVars = $orphanedBlock -replace '\}\s*$', ''
    
    Write-Host "Found orphaned block. Fixing..."
    
    # Replace the whole region: keep dark-theme closing, remove orphaned block
    $content = $content -replace [regex]::Escape($match.Groups[2].Value), ''
    
    # Now find the :root closing and inject the vars before it
    # The :root block closes right before body.dark-theme
    $rootClosePattern = '(--text-on-dark:\s*#f3f4f6;\s*\r?\n)\}'
    $content = $content -replace $rootClosePattern, ('$1' + "`n" + $orphanedVars + "}")
    
    Write-Host "Fix applied successfully."
} else {
    Write-Host "Pattern not found, trying alternate approach..."
    
    # Alternate: just look for the specific orphaned lines
    $altPattern = '(?ms)(\}\s*\r?\n)\s+--sidebar-w:\s*260px;.*?--t-spring:.*?;\s*\r?\n\}'
    if ($content -match $altPattern) {
        Write-Host "Found with alternate pattern."
    }
}

Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "Done."
