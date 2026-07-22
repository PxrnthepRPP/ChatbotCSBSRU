$cssDir = Join-Path -Path $PSScriptRoot -ChildPath 'css'
$jsDir = Join-Path -Path $PSScriptRoot -ChildPath 'js'
$indexHtml = Join-Path -Path $PSScriptRoot -ChildPath 'index.html'

$files = Get-ChildItem -Path $cssDir, $jsDir -Recurse -File | Where-Object { $_.Extension -match '\.(css|js)$' } | Select-Object -ExpandProperty FullName
$files += $indexHtml

foreach ($file in $files) {
    $content = Get-Content -Path $file -Raw
    
    $content = $content -replace '--p-', '--brand-'
    $content = $content -replace '--gold-', '--accent-'
    $content = $content -replace 'rgba\(\s*124,\s*58,\s*237', 'rgba(31, 71, 133'
    $content = $content -replace 'rgba\(\s*168,\s*85,\s*247', 'rgba(46, 107, 196'
    $content = $content -replace '(?i)#1e1145', '#0f2241'
    $content = $content -replace '(?i)#7C3AED', '#1f4785'
    $content = $content -replace '(?i)#A855F7', '#2e6bc4'
    $content = $content -replace '(?i)#2d1b69', '#152e56'
    $content = $content -replace '(?i)#4c1d95', '#0a1628'
    $content = $content -replace '--sh-purple', '--sh-brand'

    Set-Content -Path $file -Value $content -NoNewline
}

Write-Host 'Brand colors replaced!'
